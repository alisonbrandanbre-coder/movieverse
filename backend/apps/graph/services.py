"""GraphService: the cinematic map's neighborhoods, built on demand (no graph database).

For a center movie it gathers verifiable connections (docs/GRAPH_SPEC.md):
- SAGA: the other movies of its TMDB collection (`belongs_to_collection`);
- UNIVERSE: movies of the same shared universe (apps/graph/universes.py), not of its saga;
- DIRECTOR: other movies directed by any of its directors (TMDB filmography + local credits);
- ACTOR: other movies where one of its 5 lead actors is also a lead (top 5 billing);
- SIMILAR: TMDB "recommendations" and "similar" of the center;
- GENRE: shared genres (with any candidate, plus well-known local movies).

Then: strength per type → merge all types per movie into one edge → order → diversity
(no type above half of the edges, genre-only edges up to a third, at most 4 movies through
the same person; relaxed only to reach 8 edges; at most 3 movies of one saga and 4 of
saga + universe together, never relaxed) → top `limit`.

TMDB lists (filmographies, similar) go through `MovieService.cached_lists`, so expanding a
known node does not call TMDB again; if TMDB fails, whatever is cached or local is
returned and the response says `degraded`.
"""

import math
import re
from dataclasses import dataclass, field
from datetime import date

from django.db.models import Count, Q

from apps.movies.exceptions import CatalogRateLimited, CatalogUnavailable, MovieNotFound
from apps.movies.models import Movie, MoviePerson
from apps.movies.services.movie_service import MovieService, TMDBFetch
from apps.recommendations.services.scoring import quality

from .universes import Universe, universes_of

SAGA, UNIVERSE = "SAGA", "UNIVERSE"
DIRECTOR, ACTOR, SIMILAR, GENRE = "DIRECTOR", "ACTOR", "SIMILAR", "GENRE"
TYPE_ORDER = [SAGA, UNIVERSE, DIRECTOR, ACTOR, SIMILAR, GENRE]  # tie-break on equal strength
STRENGTH = {SAGA: 1.00, UNIVERSE: 0.95, DIRECTOR: 0.92, ACTOR: 0.90, SIMILAR: 0.80}
GENRE_STRENGTH_MULTI = 0.60  # 2+ shared genres
GENRE_STRENGTH_ONE = 0.35
COMBINED_BONUS = 0.05  # per extra connection type on the same edge…
COMBINED_CAP = 0.99  # …but only a saga reaches 1.00

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
MAX_PER_SAGA = 3  # hard caps: the rest of a saga is one click away ("Ver saga completa")
MAX_FRANCHISE = 4  # saga + universe together, leaving room for discoveries


@dataclass
class Connection:
    movie: Movie
    directors: dict[int, str] = field(default_factory=dict)  # person id → name
    actors: dict[int, str] = field(default_factory=dict)
    similar: bool = False
    shared_genres: list[str] = field(default_factory=list)
    saga: str = ""  # clean saga name ("Harry Potter")
    universe: str = ""  # universe name ("Universo Marvel")

    def reasons(self) -> list[tuple[str, float, str, str]]:
        """(type, strength, readable label, short label for the map's chip), strongest first."""
        found = []
        if self.saga:
            found.append((SAGA, STRENGTH[SAGA], f"De la saga {self.saga}", f"Saga {self.saga}"))
        elif self.universe:  # same saga already says it
            found.append((UNIVERSE, STRENGTH[UNIVERSE], f"Del {self.universe}", self.universe))
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
        cap = 1.0 if reasons[0][0] == SAGA else COMBINED_CAP
        return min(cap, reasons[0][1] + COMBINED_BONUS * (len(reasons) - 1))

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
class Saga:
    name: str
    total: int  # released movies of the saga, the center included


@dataclass(frozen=True)
class Neighborhood:
    center: Movie
    connections: list[Connection]
    degraded: bool
    saga: Saga | None = None


def saga_name(collection_name: str) -> str:
    """'Harry Potter - Colección' / 'Iron Man Collection' → 'Harry Potter' / 'Iron Man'."""
    name = re.sub(r"\s*[-–:]?\s*\b(colecci[oó]n|collection)\s*$", "", collection_name, flags=re.I)
    name = re.sub(r"^(colecci[oó]n|saga)\s+(de\s+)?", "", name, flags=re.I)
    return name.strip() or collection_name.strip()


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
        saga_key = _saga_key(center.collection_tmdb_id) if center.collection_tmdb_id else None
        if saga_key:
            calls[saga_key] = _collection(center.collection_tmdb_id)
        universes = universes_of(center)
        for universe in universes:
            calls.update(_universe_calls(universe))
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
        saga = None
        if saga_key:
            parts = [m for m in cached.lists.get(saga_key, []) if m.pk != center.pk]
            name = saga_name(center.collection_name)
            for movie in parts:
                connect(movie).saga = name
            self._remember_saga(center, parts)
            released = [m for m in parts if _released(m)]
            saga = Saga(name=name, total=len(released) + 1) if released else None
        for universe in universes:
            for key in _universe_calls(universe):
                for movie in cached.lists.get(key, []):
                    if movie.pk != center.pk:
                        connect(movie).universe = connect(movie).universe or universe.name
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
        return Neighborhood(
            center=center, connections=select(candidates, limit), degraded=degraded, saga=saga
        )

    def saga(self, movie_id: int) -> Neighborhood:
        """Every released movie of the center's saga ("Ver saga completa"), oldest first."""
        center = self.movies.get_details(movie_id)
        if not center.collection_tmdb_id:
            raise SagaNotFound()
        key = _saga_key(center.collection_tmdb_id)
        cached = self.movies.cached_lists({key: _collection(center.collection_tmdb_id)})
        name = saga_name(center.collection_name)
        center_genres = {g.pk: g.name for g in center.genres.all()}
        parts = [m for m in cached.lists.get(key, []) if m.pk != center.pk and _released(m)]
        self._remember_saga(center, parts)
        connections = [
            Connection(
                movie,
                saga=name,
                shared_genres=sorted(
                    center_genres[g.pk] for g in movie.genres.all() if g.pk in center_genres
                ),
            )
            for movie in sorted(parts, key=lambda m: (m.release_date, m.pk))
        ]
        return Neighborhood(
            center=center,
            connections=connections,
            degraded=bool(cached.failed),
            saga=Saga(name=name, total=len(parts) + 1),
        )

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
    def _remember_saga(center: Movie, parts: list[Movie]) -> None:
        """Keep the saga in the cache of its movies too (summaries arrive without it)."""
        Movie.objects.filter(pk__in=[m.pk for m in parts], collection_tmdb_id__isnull=True).update(
            collection_tmdb_id=center.collection_tmdb_id, collection_name=center.collection_name
        )

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
        if not _released(movie):
            return False  # announced projects in filmographies and sagas
        genres = {g.tmdb_id for g in movie.genres.all()}
        center_is_tv = any(g.tmdb_id == TV_MOVIE_TMDB_GENRE for g in center.genres.all())
        return center_is_tv or TV_MOVIE_TMDB_GENRE not in genres


class SagaNotFound(MovieNotFound):
    default_code = "SAGA_NOT_FOUND"
    default_detail = "Esta película no es parte de una saga."


def _released(movie: Movie) -> bool:
    return movie.release_date is not None and movie.release_date <= date.today()


def _saga_key(collection_tmdb_id: int) -> str:
    return f"collection:{collection_tmdb_id}"


def _collection(collection_tmdb_id: int) -> TMDBFetch:
    """A TMDB collection's movies (`parts`) as a cacheable list."""

    def fetch(client):
        return {"results": client.get_collection(collection_tmdb_id).get("parts") or []}

    return fetch


def _universe_calls(universe: Universe) -> dict[str, TMDBFetch]:
    """The lists that make up a universe: its keywords' most voted movies and its sagas."""
    calls: dict[str, TMDBFetch] = {}
    if universe.keywords:
        keywords = "|".join(str(k) for k in universe.keywords)  # any of them
        calls[f"keywords:{keywords}"] = lambda c, k=keywords: c.discover_movies(
            {"with_keywords": k, "sort_by": "vote_count.desc"}
        )
    for collection in universe.collections:
        calls[_saga_key(collection)] = _collection(collection)
    return calls


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
    per_saga: dict[str, int] = {}
    franchise = 0
    for connection in ordered:
        if len(picked) == limit:
            break
        kind = connection.primary_type
        if kind in (SAGA, UNIVERSE):
            # Hard caps (never relaxed): a saga can't fill the map.
            if franchise >= MAX_FRANCHISE or (
                kind == SAGA and per_saga.get(connection.saga, 0) >= MAX_PER_SAGA
            ):
                continue
            franchise += 1
            if kind == SAGA:
                per_saga[connection.saga] = per_saga.get(connection.saga, 0) + 1
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
