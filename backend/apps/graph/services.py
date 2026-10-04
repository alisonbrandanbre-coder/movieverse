"""GraphService: the cinematic map's neighborhoods, built on demand (no graph database).

For a center movie it gathers verifiable connections (docs/GRAPH_SPEC.md):
- DIRECTOR: other movies directed by any of its directors (TMDB filmography + local credits);
- ACTOR: other movies where one of its 5 lead actors is also a lead (top 5 billing);
- SIMILAR: TMDB "recommendations" and "similar" of the center;
- GENRE: shared genres (with any candidate, plus well-known local movies).

Then: strength per type → merge all types per movie into one edge → order → diversity
(no type above half of the edges, genre-only edges up to a third, at most 4 movies through
the same person; relaxed only to reach 8 edges) → top `limit`.

TMDB lists (filmographies, similar) go through `MovieService.cached_lists`, so expanding a
known node does not call TMDB again; if TMDB fails, whatever is cached or local is
returned and the response says `degraded`.
"""

import math
from dataclasses import dataclass, field
from datetime import date

from django.db.models import Count, Q

from apps.movies.exceptions import CatalogRateLimited, CatalogUnavailable
from apps.movies.models import Movie, MoviePerson
from apps.movies.services.movie_service import MovieService, TMDBFetch
from apps.recommendations.services.scoring import quality

DIRECTOR, ACTOR, SIMILAR, GENRE = "DIRECTOR", "ACTOR", "SIMILAR", "GENRE"
TYPE_ORDER = [DIRECTOR, ACTOR, SIMILAR, GENRE]  # tie-break when strengths are equal
STRENGTH = {DIRECTOR: 1.00, ACTOR: 0.90, SIMILAR: 0.80}
GENRE_STRENGTH_MULTI = 0.60  # 2+ shared genres
GENRE_STRENGTH_ONE = 0.35
COMBINED_BONUS = 0.05  # per extra connection type on the same edge (capped at 1.0)

LEAD_ACTORS = 5  # "actor principal": top 5 billing, in both movies
PERSON_MOVIES = 20  # most voted titles kept per filmography
MIN_VOTES = 50  # below this a movie has no signal to show on the map
GENRE_POOL_MIN_VOTES = 1000  # local movies only connected by genre must be well known
GENRE_POOL_SIZE = 40
TV_MOVIE_TMDB_GENRE = 10770

DEFAULT_LIMIT = 12
MAX_LIMIT = 12
MAX_TYPE_SHARE = 0.5  # no connection type takes more than half of the edges
MAX_GENRE_ONLY_SHARE = 1 / 3
MAX_PER_PERSON = 4
MIN_RESULTS = 8  # caps are relaxed only to reach this many edges ("top 8–12")


@dataclass
class Connection:
    movie: Movie
    directors: dict[int, str] = field(default_factory=dict)  # person id → name
    actors: dict[int, str] = field(default_factory=dict)
    similar: bool = False
    shared_genres: list[str] = field(default_factory=list)

    def reasons(self) -> list[tuple[str, float, str, str]]:
        """(type, strength, readable label, short label for the map's chip), strongest first."""
        found = []
        if self.directors:
            names = list(self.directors.values())
            found.append((DIRECTOR, STRENGTH[DIRECTOR], "Dirigidas por " + _join(names), names[0]))
        if self.actors:
            names = list(self.actors.values())
            found.append((ACTOR, STRENGTH[ACTOR], "Ambas con " + _join(names), names[0]))
        if self.similar:
            found.append((SIMILAR, STRENGTH[SIMILAR], "Similares según TMDB", "Similar"))
        if self.shared_genres:
            strength = GENRE_STRENGTH_MULTI if len(self.shared_genres) >= 2 else GENRE_STRENGTH_ONE
            found.append(
                (GENRE, strength, "Comparten " + _join(self.shared_genres), self.shared_genres[0])
            )
        return sorted(found, key=lambda r: (-r[1], TYPE_ORDER.index(r[0])))

    @property
    def strength(self) -> float:
        reasons = self.reasons()
        if not reasons:
            return 0.0
        return min(1.0, reasons[0][1] + COMBINED_BONUS * (len(reasons) - 1))

    @property
    def primary_type(self) -> str:
        return self.reasons()[0][0]

    @property
    def people(self) -> set[int]:
        """People behind the primary connection (for the per-person cap)."""
        if self.primary_type == DIRECTOR:
            return set(self.directors)
        if self.primary_type == ACTOR:
            return set(self.actors)
        return set()


@dataclass(frozen=True)
class Neighborhood:
    center: Movie
    connections: list[Connection]
    degraded: bool


def _join(names) -> str:
    names = list(dict.fromkeys(names))
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " y " + names[-1]


class GraphService:
    def __init__(self, movie_service: MovieService | None = None):
        self.movies = movie_service or MovieService()

    def neighborhood(self, movie_id: int, limit: int = DEFAULT_LIMIT) -> Neighborhood:
        center = self.movies.get_details(movie_id)  # 404 if unknown; cached if TMDB fails
        degraded = False
        try:
            credits = self.movies.get_credits(center.pk)
            directors = [c.person for c in credits.directors]
            leads = [c.person for c in credits.cast[:LEAD_ACTORS]]
        except (CatalogUnavailable, CatalogRateLimited):
            directors, leads, degraded = [], [], True

        calls: dict[str, TMDBFetch] = {
            f"recommendations:{center.tmdb_id}": lambda c, t=center.tmdb_id: (
                c.get_movie_recommendations(t)
            ),
            f"similar:{center.tmdb_id}": lambda c, t=center.tmdb_id: c.get_similar_movies(t),
        }
        for person in directors:
            calls[f"person:{person.tmdb_id}:directed"] = _filmography(person.tmdb_id, directed=True)
        for person in leads:
            calls[f"person:{person.tmdb_id}:lead"] = _filmography(person.tmdb_id, directed=False)
        cached = self.movies.cached_lists(calls)
        degraded = degraded or bool(cached.failed)

        found: dict[int, Connection] = {}

        def connect(movie: Movie) -> Connection:
            return found.setdefault(movie.pk, Connection(movie))

        for person in directors:
            for movie in cached.lists.get(f"person:{person.tmdb_id}:directed", []):
                connect(movie).directors[person.pk] = person.name
        for person in leads:
            for movie in cached.lists.get(f"person:{person.tmdb_id}:lead", []):
                connect(movie).actors[person.pk] = person.name
        for kind in ("recommendations", "similar"):
            for movie in cached.lists.get(f"{kind}:{center.tmdb_id}", []):
                connect(movie).similar = True
        self._local_people(center, directors, leads, connect)
        for movie in self._genre_pool(center):
            connect(movie)

        center_genres = {g.pk: g.name for g in center.genres.all()}
        for connection in found.values():
            connection.shared_genres = sorted(
                center_genres[g.pk] for g in connection.movie.genres.all() if g.pk in center_genres
            )

        candidates = [c for c in found.values() if self._eligible(c, center)]
        candidates.sort(
            key=lambda c: (
                -c.strength,
                -quality(c.movie.vote_average, c.movie.vote_count),
                -c.movie.vote_count,
                c.movie.pk,
            )
        )
        return Neighborhood(center=center, connections=select(candidates, limit), degraded=degraded)

    # ------------------------------------------------------------ sources

    @staticmethod
    def _local_people(center: Movie, directors, leads, connect) -> None:
        """Credits already cached locally (movies the users opened) also count."""
        rows = (
            MoviePerson.objects.filter(
                Q(person__in=directors, role_type=MoviePerson.RoleType.DIRECTOR)
                | Q(
                    person__in=leads,
                    role_type=MoviePerson.RoleType.ACTOR,
                    credit_order__lt=LEAD_ACTORS,
                )
            )
            .exclude(movie=center)
            .select_related("movie", "person")
            .prefetch_related("movie__genres")
        )
        for row in rows:
            people = (
                connect(row.movie).directors
                if row.role_type == "DIRECTOR"
                else connect(row.movie).actors
            )
            people[row.person_id] = row.person.name

    @staticmethod
    def _genre_pool(center: Movie):
        genre_ids = [g.pk for g in center.genres.all()]
        if not genre_ids:
            return []
        return (
            Movie.objects.filter(genres__in=genre_ids, vote_count__gte=GENRE_POOL_MIN_VOTES)
            .exclude(pk=center.pk)
            .annotate(shared=Count("genres", filter=Q(genres__in=genre_ids), distinct=True))
            .prefetch_related("genres")
            .order_by("-shared", "-vote_count", "id")[:GENRE_POOL_SIZE]
        )

    @staticmethod
    def _eligible(connection: Connection, center: Movie) -> bool:
        movie = connection.movie
        if movie.pk == center.pk or movie.vote_count < MIN_VOTES or not connection.reasons():
            return False
        if movie.release_date is None or movie.release_date > date.today():
            return False  # announced projects in filmographies
        genres = {g.tmdb_id for g in movie.genres.all()}
        center_is_tv = any(g.tmdb_id == TV_MOVIE_TMDB_GENRE for g in center.genres.all())
        return center_is_tv or TV_MOVIE_TMDB_GENRE not in genres


def _filmography(person_tmdb_id: int, *, directed: bool) -> TMDBFetch:
    """A person's most voted movies where they directed (or were a lead actor)."""

    def fetch(client):
        credits = client.get_person_movie_credits(person_tmdb_id)
        if directed:
            items = [m for m in credits.get("crew") or [] if m.get("job") == "Director"]
        else:
            items = [
                m
                for m in credits.get("cast") or []
                if isinstance(m.get("order"), int) and m["order"] < LEAD_ACTORS
            ]
        items = list({m["id"]: m for m in items if isinstance(m.get("id"), int)}.values())
        items.sort(key=lambda m: -(m.get("vote_count") or 0))
        return {"results": items[:PERSON_MOVIES]}

    return fetch


def select(ordered: list[Connection], limit: int) -> list[Connection]:
    """Top `limit` with diversity. Caps are relaxed only to reach MIN_RESULTS edges: a
    shorter but varied neighborhood beats 12 near-identical ones."""
    max_per_type = max(1, math.ceil(limit * MAX_TYPE_SHARE))
    max_genre_only = max(1, math.floor(limit * MAX_GENRE_ONLY_SHARE))
    picked: list[Connection] = []
    deferred: list[Connection] = []
    per_type: dict[str, int] = {}
    per_person: dict[int, int] = {}
    for connection in ordered:
        if len(picked) == limit:
            break
        kind = connection.primary_type
        type_cap = max_genre_only if kind == GENRE else max_per_type
        if per_type.get(kind, 0) >= type_cap or any(
            per_person.get(p, 0) >= MAX_PER_PERSON for p in connection.people
        ):
            deferred.append(connection)
            continue
        picked.append(connection)
        per_type[kind] = per_type.get(kind, 0) + 1
        for person in connection.people:
            per_person[person] = per_person.get(person, 0) + 1
    picked += deferred[: max(0, min(limit, MIN_RESULTS) - len(picked))]
    rank = {id(c): i for i, c in enumerate(ordered)}
    return sorted(picked, key=lambda c: (-c.strength, rank[id(c)]))
