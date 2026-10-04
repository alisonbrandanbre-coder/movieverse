"""Candidate generation: which movies are worth scoring for a user.

Sources (each TMDB list is cached in `TMDBListCache` for TMDB_CACHE_DAYS, so repeating a
refresh does not repeat calls):
- `/discover` by the top preferred genres (popular and acclaimed), by preferred decades and
  by preferred non-English languages, always without the genres to avoid;
- TMDB "recommendations" and "similar" of the user's favorites and likes (seeds);
- the local catalog (movies already cached in PostgreSQL) with liked genres: no network,
  so there is something to rank even if TMDB is down.

Hard exclusions: anything the user already interacted with (watched, disliked, favorites,
likes, watchlist), any genre to avoid, unreleased titles, titles without enough votes and
TV movies (unless the user chose that genre).
"""

from dataclasses import dataclass, field
from datetime import date

from django.db.models import QuerySet

from apps.movies.models import Genre, Movie, MoviePerson
from apps.movies.services.movie_service import MovieService, TMDBFetch
from apps.preferences.taste import Seed, Taste

MIN_VOTES = 200  # "discovery" never means recommending titles without any signal
MAX_DISCOVER_GENRES = 3
MAX_DECADES = 3
MAX_LANGUAGES = 2
LOCAL_POOL_SIZE = 300
FALLBACK_MIN_VOTES = 1000
# TMDB "Película de TV" (specials, direct-to-TV sequels): excluded unless the user chose it.
TV_MOVIE_TMDB_GENRE = 10770


@dataclass(frozen=True)
class SeedLink:
    seed: Seed
    source: str  # "recommendations" | "similar"


@dataclass
class Candidate:
    movie: Movie
    genre_ids: set[int]
    seed_links: list[SeedLink] = field(default_factory=list)  # seeds whose lists include it
    directors: dict[int, str] = field(default_factory=dict)  # person id → name


@dataclass(frozen=True)
class CandidatePool:
    candidates: list[Candidate]
    degraded: bool  # some TMDB source failed and had no cache


def _discover(params: dict) -> TMDBFetch:
    return lambda client: client.discover_movies(params)


def _key(prefix: str, params: dict) -> str:
    return prefix + ":" + "&".join(f"{k}={params[k]}" for k in sorted(params))


class CandidateService:
    def __init__(self, movie_service: MovieService):
        self.movies = movie_service

    def personalized(self, taste: Taste) -> CandidatePool:
        genres = Genre.objects.in_bulk()
        tmdb = {gid: genres[gid].tmdb_id for gid in genres}
        ranked_genres = sorted(
            (g for g in taste.positive_genre_ids if g in tmdb),
            key=lambda g: (-taste.genre_weights[g], g),
        )[:MAX_DISCOVER_GENRES]
        avoid = "|".join(str(tmdb[g]) for g in sorted(taste.disliked_genre_ids) if g in tmdb)
        union = "|".join(str(tmdb[g]) for g in ranked_genres)
        base = {"without_genres": avoid} if avoid else {}

        calls: dict[str, TMDBFetch] = {}

        def add(params: dict) -> None:
            params = {**base, **params}
            calls[_key("discover", params)] = _discover(params)

        for genre_id in ranked_genres:
            add(
                {"with_genres": tmdb[genre_id], "sort_by": "popularity.desc", "vote_count.gte": 300}
            )
            add(
                {
                    "with_genres": tmdb[genre_id],
                    "sort_by": "vote_average.desc",
                    "vote_count.gte": 300,
                }
            )
        for decade in sorted(taste.decades)[:MAX_DECADES]:
            add(
                {
                    **({"with_genres": union} if union else {}),
                    "primary_release_date.gte": f"{decade}-01-01",
                    "primary_release_date.lte": f"{decade + 9}-12-31",
                    "sort_by": "vote_average.desc",
                    "vote_count.gte": 200,
                }
            )
        for language in sorted(taste.languages - {"en"})[:MAX_LANGUAGES]:
            add(
                {
                    **({"with_genres": union} if union else {}),
                    "with_original_language": language,
                    "sort_by": "vote_count.desc",
                    "vote_count.gte": MIN_VOTES,
                }
            )
        seed_keys: dict[str, SeedLink] = {}
        for seed in taste.seeds:
            tid = seed.movie.tmdb_id
            for kind, fetch in (
                ("recommendations", lambda c, t=tid: c.get_movie_recommendations(t)),
                ("similar", lambda c, t=tid: c.get_similar_movies(t)),
            ):
                key = f"{kind}:{tid}"
                calls[key] = fetch
                seed_keys[key] = SeedLink(seed, kind)

        cached = self.movies.cached_lists(calls)
        candidates: dict[int, Candidate] = {}
        for key, movies in cached.lists.items():
            for movie in movies:
                candidate = candidates.setdefault(movie.pk, Candidate(movie, _genres(movie)))
                link = seed_keys.get(key)
                if link and link not in candidate.seed_links:
                    candidate.seed_links.append(link)
        for movie in self._local_pool(taste.positive_genre_ids):
            candidates.setdefault(movie.pk, Candidate(movie, _genres(movie)))

        tv_movie = Genre.objects.filter(tmdb_id=TV_MOVIE_TMDB_GENRE).values_list("pk", flat=True)
        skip = set(tv_movie) - taste.preferred_genre_ids
        kept = [
            c for c in candidates.values() if self._eligible(c, taste) and not c.genre_ids & skip
        ]
        self.attach_directors(kept)
        return CandidatePool(candidates=kept, degraded=bool(cached.failed))

    def fallback(self, taste: Taste) -> CandidatePool:
        """Popular, well rated titles: used while the onboarding is incomplete."""
        params = {"sort_by": "vote_count.desc", "vote_average.gte": 7, "vote_count.gte": 2000}
        cached = self.movies.cached_lists({_key("discover", params): _discover(params)})
        movies = {m.pk: m for lst in cached.lists.values() for m in lst}
        local = Movie.objects.filter(vote_count__gte=FALLBACK_MIN_VOTES).prefetch_related("genres")
        for movie in local.order_by("-vote_count")[:LOCAL_POOL_SIZE]:
            movies.setdefault(movie.pk, movie)
        kept = [Candidate(m, _genres(m)) for m in movies.values()]
        kept = [c for c in kept if self._eligible(c, taste)]
        self.attach_directors(kept)
        return CandidatePool(candidates=kept, degraded=bool(cached.failed))

    @staticmethod
    def attach_directors(candidates: list[Candidate]) -> None:
        """Directors known locally (credits synced). Unknown directors are simply empty."""
        by_movie = {c.movie.pk: c for c in candidates}
        rows = MoviePerson.objects.filter(
            movie_id__in=by_movie, role_type=MoviePerson.RoleType.DIRECTOR
        ).values_list("movie_id", "person_id", "person__name")
        for movie_id, person_id, name in rows:
            by_movie[movie_id].directors[person_id] = name

    @staticmethod
    def _local_pool(genre_ids: frozenset[int]) -> QuerySet[Movie]:
        return (
            Movie.objects.filter(genres__in=genre_ids, vote_count__gte=MIN_VOTES)
            .distinct()
            .prefetch_related("genres")
            .order_by("-vote_count", "id")[:LOCAL_POOL_SIZE]
        )

    @staticmethod
    def _eligible(candidate: Candidate, taste: Taste) -> bool:
        movie = candidate.movie
        return (
            movie.pk not in taste.excluded_movie_ids
            and not candidate.genre_ids & taste.disliked_genre_ids
            and movie.vote_count >= MIN_VOTES
            and (movie.release_date is None or movie.release_date <= date.today())
        )


def _genres(movie: Movie) -> set[int]:
    return {g.pk for g in movie.genres.all()}
