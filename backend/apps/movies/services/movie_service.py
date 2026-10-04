"""MovieService: the catalog's single entry point for views (and future Graph/Recommendation).

Cache policy (docs/SPRINT_1_REPORT.md → "Persistencia"):
- Search results are upserted as *summary* rows (no runtime, no credits).
- Full metadata and credits are fetched on first access and refreshed only when older
  than `TMDB_CACHE_DAYS`. If TMDB fails while refreshing, cached data is served.
- Discover pages (Buscar / Descubrir without text) are cached `DISCOVER_MAX_AGE`, the
  region's streaming platforms `TMDB_CACHE_DAYS` and each movie's "Dónde verla"
  `PROVIDERS_MAX_AGE`; all of them in `TMDBListCache` / `Movie` (no Redis in the MVP).
"""

import hashlib
import logging
import math
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone

from ..exceptions import CatalogRateLimited, CatalogUnavailable, MoodNotFound, MovieNotFound
from ..filters import RELEVANCE, MovieFilters
from ..models import Genre, Movie, MoviePerson, Person, TMDBListCache, WatchProvider
from ..moods import BASE_PARAMS, MOODS
from .normalizers import (
    PersonCredit,
    genre_tmdb_ids,
    normalize_credits,
    normalize_genres,
    normalize_movie,
    normalize_movie_details,
    normalize_movie_watch_providers,
    normalize_watch_providers,
)
from .tmdb_client import TMDBClient, TMDBError, TMDBNotFound, TMDBRateLimited

logger = logging.getLogger(__name__)

CAST_STORE_LIMIT = 15  # stored for the graph ("lead actors")
CAST_RESPONSE_LIMIT = 10  # returned by the credits endpoint
MAX_DB_ID = 2**63 - 1
# Onboarding sample: only titles most users have heard of, so they can rate them quickly.
WELL_KNOWN_MIN_VOTES = 1000
WELL_KNOWN_TMDB_PAGES = 2
TMDB_PARALLEL_CALLS = 6
# Home lists: trending changes during the week, so it is refreshed more often than the
# rest of the TMDB cache; mood results are stable and follow TMDB_CACHE_DAYS.
TRENDING_MAX_AGE = timedelta(hours=6)
HOME_LIST_SIZE = 20
MOOD_MAX_PAGE = 5

# Filtered search: TMDB's search has no filters, so its first pages are filtered here and
# paginated locally (a bounded scan keeps TMDB calls and latency predictable).
FILTERED_SEARCH_TMDB_PAGES = 3
FILTERED_PAGE_SIZE = 20
TMDB_MAX_PAGE = 500
# Discover results follow TMDB's popularity, which moves during the day.
DISCOVER_MAX_AGE = timedelta(hours=12)
# Streaming catalogs change often: a movie's platforms are asked again after 2 days.
PROVIDERS_MAX_AGE = timedelta(days=2)
# Platforms offered by the filter. TMDB's regional priority mixes rent/buy stores and niche
# services (in AR, HBO Max comes 35th), so the main streaming services are curated per region
# (TMDB ids, in display order; names and logos still come from TMDB, and one TMDB no longer
# lists is skipped). Other regions get their first PROVIDER_LIST_SIZE by priority.
FEATURED_PROVIDERS: dict[str, list[int]] = {
    # Netflix, Prime Video, Disney+, HBO Max, Apple TV, Paramount+, Mercado Play, MUBI,
    # Crunchyroll, CINE.AR, Pluto TV, Claro video.
    "AR": [8, 119, 337, 1899, 350, 531, 2302, 11, 283, 491, 300, 167],
}
PROVIDER_LIST_SIZE = 12

TMDBFetch = Callable[[TMDBClient], dict[str, Any]]
# Values that change often in TMDB and are refreshed on every search hit.
SEARCH_REFRESH_FIELDS = ["popularity", "vote_average", "vote_count"]


@dataclass(frozen=True)
class SearchResult:
    query: str
    page: int
    total_pages: int
    total_results: int
    movies: list[Movie]


@dataclass(frozen=True)
class CachedLists:
    lists: dict[str, list[Movie]]
    failed: list[str]  # keys TMDB could not answer and that had no cache


@dataclass(frozen=True)
class MovieList:
    movies: list[Movie]
    degraded: bool  # TMDB failed and there was no cache: local catalog instead
    page: int = 1
    has_more: bool = False


@dataclass(frozen=True)
class MovieCredits:
    directors: list[MoviePerson]
    cast: list[MoviePerson]


def _to_api_error(exc: TMDBError) -> Exception:
    if isinstance(exc, TMDBRateLimited):
        return CatalogRateLimited()
    return CatalogUnavailable()


class MovieService:
    def __init__(self, client: TMDBClient | None = None):
        self.client = client or TMDBClient()

    # ------------------------------------------------------------ search

    def search(
        self,
        query: str,
        page: int = 1,
        filters: MovieFilters | None = None,
        exclude_ids: set[int] | frozenset[int] = frozenset(),
    ) -> SearchResult:
        """TMDB's search. With filters, another order or movies to hide (the ones the user
        watched), its first pages are filtered and sorted here."""
        filters = filters or MovieFilters()
        if filters.active or filters.sort != RELEVANCE or exclude_ids:
            return self._filtered_search(query, page, filters, exclude_ids)
        try:
            payload = self.client.search_movies(query, page=page)
        except TMDBError as exc:
            raise _to_api_error(exc) from exc

        results = [r for r in payload.get("results") or [] if isinstance(r.get("id"), int)]
        movies = self._upsert_summaries(results)
        return SearchResult(
            query=query,
            page=int(payload.get("page") or page),
            total_pages=int(payload.get("total_pages") or 0),
            total_results=int(payload.get("total_results") or 0),
            movies=movies,
        )

    def _filtered_search(
        self, query: str, page: int, filters: MovieFilters, exclude_ids: set[int] | frozenset[int]
    ) -> SearchResult:
        """The first TMDB search pages, filtered and sorted here and paginated locally.

        Runtime and country filters need each candidate's details, platform filters its
        watch providers (search results have neither). Only the candidates that pass the
        cheaper filters get them, fetched in parallel once and cached.
        """
        try:
            first = self.client.search_movies(query, page=1)
        except TMDBError as exc:
            raise _to_api_error(exc) from exc
        pages = min(int(first.get("total_pages") or 0), FILTERED_SEARCH_TMDB_PAGES)
        payloads = [first]
        rest = self._fetch_parallel(
            {
                str(n): (lambda client, n=n: client.search_movies(query, page=n))
                for n in range(2, pages + 1)
            }
        )
        for n in range(2, pages + 1):
            result = rest[str(n)]
            if isinstance(result, TMDBError):  # keep what we have
                logger.warning("Filtered search page %s failed: %r", n, result)
                continue
            payloads.append(result)

        seen: dict[int, dict] = {}
        for payload in payloads:
            for r in payload.get("results") or []:
                if isinstance(r.get("id"), int):
                    seen.setdefault(r["id"], r)
        movies = [m for m in self._upsert_summaries(list(seen.values())) if m.pk not in exclude_ids]
        if filters.needs_details:
            cheap = filters.without_costly()
            self.ensure_details([m for m in self._with_genres(movies) if cheap.matches(m)])
        if filters.provider_ids:
            others = filters.without_providers()
            self.ensure_watch_providers([m for m in self._with_genres(movies) if others.matches(m)])
        matching = filters.sort_movies([m for m in self._with_genres(movies) if filters.matches(m)])

        start = (page - 1) * FILTERED_PAGE_SIZE
        return SearchResult(
            query=query,
            page=page,
            total_pages=math.ceil(len(matching) / FILTERED_PAGE_SIZE),
            total_results=len(matching),
            movies=matching[start : start + FILTERED_PAGE_SIZE],
        )

    def discover(
        self,
        filters: MovieFilters,
        page: int = 1,
        exclude_ids: set[int] | frozenset[int] = frozenset(),
    ) -> SearchResult:
        """TMDB `/discover/movie` with the Buscar / Descubrir filters, cached
        `DISCOVER_MAX_AGE` per filters and page (a stale page is served if TMDB fails).
        `exclude_ids` (watched movies) are dropped from the page, so it may be shorter."""
        digest = hashlib.sha1(f"{filters.key}&page={page}".encode()).hexdigest()
        key = f"discover:{digest}"
        entry = TMDBListCache.objects.filter(key=key).first()
        if entry is None or self._is_stale(entry.fetched_at, DISCOVER_MAX_AGE):
            try:
                payload = self.client.discover_movies(filters.discover_params(), page=page)
            except TMDBError as exc:
                if entry is None:
                    raise _to_api_error(exc) from exc
                logger.warning("Serving a stale discover page (%s): %r", filters.key, exc)
            else:
                results = [r for r in payload.get("results") or [] if isinstance(r.get("id"), int)]
                self._upsert_summaries(results)
                entry, _ = TMDBListCache.objects.update_or_create(
                    key=key,
                    defaults={
                        "tmdb_ids": [r["id"] for r in results],
                        "extra": {
                            "total_pages": int(payload.get("total_pages") or 0),
                            "total_results": int(payload.get("total_results") or 0),
                        },
                        "fetched_at": timezone.now(),
                    },
                )
        movies = Movie.objects.in_bulk(entry.tmdb_ids, field_name="tmdb_id")
        return SearchResult(
            query="",
            page=page,
            total_pages=min(int(entry.extra.get("total_pages") or 0), TMDB_MAX_PAGE),
            total_results=int(entry.extra.get("total_results") or 0),
            movies=[
                movies[tid]
                for tid in entry.tmdb_ids
                if tid in movies and movies[tid].pk not in exclude_ids
            ],
        )

    # ------------------------------------------------------------ where to watch

    def watch_providers(self) -> list[WatchProvider]:
        """The region's main streaming platforms (filter chips: FEATURED_PROVIDERS), asked to
        TMDB at most once per `TMDB_CACHE_DAYS`; a stale list is served if TMDB fails, [] if
        there is none."""
        region = settings.TMDB_WATCH_REGION
        key = f"providers:{region}"
        entry = TMDBListCache.objects.filter(key=key).first()
        if entry is None or self._is_stale(entry.fetched_at):
            try:
                payload = self.client.get_watch_providers(region)
            except TMDBError as exc:
                logger.warning("Could not load the watch providers of %s: %r", region, exc)
            else:
                providers = normalize_watch_providers(payload, region)
                if region in FEATURED_PROVIDERS:
                    by_tmdb_id = {p["tmdb_id"]: p for p in providers}
                    featured = FEATURED_PROVIDERS[region]
                    providers = [by_tmdb_id[i] for i in featured if i in by_tmdb_id]
                else:
                    providers = providers[:PROVIDER_LIST_SIZE]
                for provider in providers:
                    WatchProvider.objects.update_or_create(
                        tmdb_id=provider["tmdb_id"],
                        defaults={k: v for k, v in provider.items() if k != "tmdb_id"},
                    )
                entry, _ = TMDBListCache.objects.update_or_create(
                    key=key,
                    defaults={
                        "tmdb_ids": [p["tmdb_id"] for p in providers],
                        "fetched_at": timezone.now(),
                    },
                )
        if entry is None:
            return []
        by_id = WatchProvider.objects.in_bulk(entry.tmdb_ids, field_name="tmdb_id")
        return [by_id[tid] for tid in entry.tmdb_ids if tid in by_id]

    def get_movie_watch_providers(self, movie_id: int) -> dict[str, Any]:
        """A movie's "Dónde verla" in the region: {link, streaming, rent, buy}. Refreshed
        after `PROVIDERS_MAX_AGE`; if TMDB fails, the cached ones (error if never synced)."""
        movie = self.get_movie(movie_id)
        if self._is_stale(movie.providers_synced_at, PROVIDERS_MAX_AGE):
            try:
                payload = self.client.get_movie_watch_providers(movie.tmdb_id)
            except TMDBError as exc:
                if movie.providers_synced_at is None:
                    raise _to_api_error(exc) from exc
                logger.warning("Serving cached watch providers for movie %s: %r", movie.pk, exc)
            else:
                self._store_watch_providers(movie, payload)
        return movie.watch_providers

    def ensure_watch_providers(self, movies: list[Movie]) -> None:
        """Sync the watch providers of the movies with none or stale ones (parallel, best
        effort: a failure leaves the movie without platforms, so it does not match)."""
        missing = {
            str(m.pk): m for m in movies if self._is_stale(m.providers_synced_at, PROVIDERS_MAX_AGE)
        }
        calls = {
            key: (lambda client, tmdb_id=movie.tmdb_id: client.get_movie_watch_providers(tmdb_id))
            for key, movie in missing.items()
        }
        for key, result in self._fetch_parallel(calls).items():
            if isinstance(result, TMDBError):
                logger.warning("Could not sync watch providers for movie %s: %r", key, result)
                continue
            self._store_watch_providers(missing[key], result)

    @staticmethod
    def _store_watch_providers(movie: Movie, payload: dict[str, Any]) -> None:
        movie.watch_providers = normalize_movie_watch_providers(payload, settings.TMDB_WATCH_REGION)
        movie.providers_synced_at = timezone.now()
        movie.save(update_fields=["watch_providers", "providers_synced_at", "updated_at"])

    @staticmethod
    def _with_genres(movies: list[Movie]) -> list[Movie]:
        """Fresh rows with their genres prefetched, in the same order."""
        by_id = Movie.objects.prefetch_related("genres").in_bulk([m.pk for m in movies])
        return [by_id[m.pk] for m in movies if m.pk in by_id]

    # ------------------------------------------------------------ single movie

    @staticmethod
    def get_movie(movie_id: int) -> Movie:
        if not 0 < movie_id <= MAX_DB_ID:
            raise MovieNotFound()
        movie = Movie.objects.filter(pk=movie_id).prefetch_related("genres").first()
        if movie is None:
            raise MovieNotFound()
        return movie

    def get_details(self, movie_id: int) -> Movie:
        movie = self.get_movie(movie_id)
        if self._is_stale(movie.metadata_synced_at):
            try:
                movie = self.sync_metadata(movie)
            except TMDBError as exc:
                # Serve the cached row rather than failing the page.
                logger.warning("Serving cached metadata for movie %s: %r", movie.pk, exc)
        return movie

    def get_or_create_from_tmdb(self, tmdb_id: int) -> Movie:
        """Reuse the local movie if it exists; otherwise fetch, normalize and store it."""
        existing = Movie.objects.filter(tmdb_id=tmdb_id).first()
        if existing is not None:
            return existing
        try:
            payload = self.client.get_movie_details(tmdb_id)
        except TMDBNotFound as exc:
            raise MovieNotFound() from exc
        except TMDBError as exc:
            raise _to_api_error(exc) from exc
        try:
            with transaction.atomic():
                movie = Movie.objects.create(tmdb_id=tmdb_id, **normalize_movie_details(payload))
                self._apply_details(movie, payload)
        except IntegrityError:  # created concurrently by another request
            movie = Movie.objects.get(tmdb_id=tmdb_id)
        return movie

    def sync_metadata(self, movie: Movie) -> Movie:
        """Fetch full details from TMDB and update the local row + genres. Raises TMDBError."""
        payload = self.client.get_movie_details(movie.tmdb_id)
        with transaction.atomic():
            for field, value in normalize_movie_details(payload).items():
                setattr(movie, field, value)
            self._apply_details(movie, payload)
        return self.get_movie(movie.pk)

    # ------------------------------------------------------------ credits

    def get_credits(self, movie_id: int) -> MovieCredits:
        movie = self.get_movie(movie_id)
        if self._is_stale(movie.credits_synced_at):
            try:
                self.sync_credits(movie)
            except TMDBError as exc:
                if movie.credits_synced_at is None:
                    raise _to_api_error(exc) from exc
                logger.warning("Serving cached credits for movie %s: %r", movie.pk, exc)
        return self._load_credits(movie)

    def sync_credits(self, movie: Movie) -> None:
        """Replace the movie's stored directors and main cast. Raises TMDBError."""
        self._store_credits(movie, self.client.get_movie_credits(movie.tmdb_id))

    def _store_credits(self, movie: Movie, payload: dict[str, Any]) -> None:
        credits = normalize_credits(payload, cast_limit=CAST_STORE_LIMIT)
        with transaction.atomic():
            people = self._upsert_people([*credits.directors, *credits.cast])
            rows = [
                MoviePerson(
                    movie=movie,
                    person=people[c.tmdb_id],
                    role_type=MoviePerson.RoleType.DIRECTOR,
                )
                for c in credits.directors
            ] + [
                MoviePerson(
                    movie=movie,
                    person=people[c.tmdb_id],
                    role_type=MoviePerson.RoleType.ACTOR,
                    character=c.character,
                    credit_order=c.order,
                )
                for c in credits.cast
            ]
            MoviePerson.objects.filter(movie=movie).delete()
            MoviePerson.objects.bulk_create(rows)
            movie.credits_synced_at = timezone.now()
            movie.save(update_fields=["credits_synced_at", "updated_at"])

    # ------------------------------------------------------------ genres

    def ensure_genre_catalog(self) -> None:
        """Load TMDB's genre list once so search results can be linked to genres."""
        if Genre.objects.exists():
            return
        try:
            genres = normalize_genres(self.client.get_genres())
        except TMDBError as exc:
            logger.warning("Could not load TMDB genre list: %r", exc)
            return
        self._upsert_genres(genres)

    # ------------------------------------------------------------ cached lists

    def cached_lists(
        self, calls: dict[str, TMDBFetch], max_age: timedelta | None = None
    ) -> CachedLists:
        """Movies of several TMDB list calls, asking TMDB at most once per `TMDB_CACHE_DAYS`
        (or `max_age`).

        `calls` maps a stable cache key to a function that receives the client and returns
        the raw payload (with `results`). Stale or missing lists are fetched in parallel
        (network only; DB writes stay in this thread), upserted as summary rows and stored
        in `TMDBListCache`. If TMDB fails, a stale list is served; a key that failed with no
        cache at all is reported in `failed` instead of raising.
        """
        entries = {e.key: e for e in TMDBListCache.objects.filter(key__in=calls)}
        stale = {
            key: fetch
            for key, fetch in calls.items()
            if key not in entries or self._is_stale(entries[key].fetched_at, max_age)
        }
        failed = []
        for key, result in self._fetch_parallel(stale).items():
            if isinstance(result, TMDBError):
                logger.warning("TMDB list %s failed: %r", key, result)
                if key not in entries:
                    failed.append(key)
                continue
            results = [r for r in result.get("results") or [] if isinstance(r.get("id"), int)]
            self._upsert_summaries(results)
            entries[key], _ = TMDBListCache.objects.update_or_create(
                key=key,
                defaults={"tmdb_ids": [r["id"] for r in results], "fetched_at": timezone.now()},
            )
        all_ids = {tid for entry in entries.values() for tid in entry.tmdb_ids}
        movies = Movie.objects.prefetch_related("genres").in_bulk(all_ids, field_name="tmdb_id")
        lists = {
            key: [movies[tid] for tid in entry.tmdb_ids if tid in movies]
            for key, entry in entries.items()
        }
        return CachedLists(lists=lists, failed=failed)

    def ensure_details(self, movies: list[Movie]) -> None:
        """Sync the full details (runtime, genres…) of the movies that only have a summary
        (parallel, best effort: a failure leaves the summary)."""
        missing = {str(m.pk): m for m in movies if m.metadata_synced_at is None}
        calls = {
            key: (lambda client, tmdb_id=movie.tmdb_id: client.get_movie_details(tmdb_id))
            for key, movie in missing.items()
        }
        for key, result in self._fetch_parallel(calls).items():
            if isinstance(result, TMDBError):
                logger.warning("Could not sync details for movie %s: %r", key, result)
                continue
            movie = missing[key]
            with transaction.atomic():
                for field, value in normalize_movie_details(result).items():
                    setattr(movie, field, value)
                self._apply_details(movie, result)

    def ensure_credits(self, movies: list[Movie]) -> None:
        """Sync credits of the movies that never had them (parallel, best effort)."""
        missing = {str(m.pk): m for m in movies if m.credits_synced_at is None}
        calls = {
            key: (lambda client, tmdb_id=movie.tmdb_id: client.get_movie_credits(tmdb_id))
            for key, movie in missing.items()
        }
        for key, result in self._fetch_parallel(calls).items():
            if isinstance(result, TMDBError):
                logger.warning("Could not sync credits for movie %s: %r", key, result)
                continue
            self._store_credits(missing[key], result)

    def _fetch_parallel(self, calls: dict[str, TMDBFetch]) -> dict[str, Any]:
        """Run TMDB calls concurrently. Values are payloads or the `TMDBError` raised."""
        if not calls:
            return {}
        results: dict[str, Any] = {}
        with ThreadPoolExecutor(max_workers=min(TMDB_PARALLEL_CALLS, len(calls))) as pool:
            futures = {key: pool.submit(fetch, self.client) for key, fetch in calls.items()}
            for key, future in futures.items():
                try:
                    results[key] = future.result()
                except TMDBError as exc:
                    results[key] = exc
        return results

    # ------------------------------------------------------------ home lists

    def trending(self) -> MovieList:
        """TMDB's trending movies of the week (cached 6 h). If TMDB fails with no cache,
        the most popular local movies, flagged as degraded."""
        key = "trending:week"
        cached = self.cached_lists(
            {key: lambda client: client.get_trending_movies("week")}, max_age=TRENDING_MAX_AGE
        )
        movies = [m for m in cached.lists.get(key, []) if m.poster_path][:HOME_LIST_SIZE]
        if movies:
            return MovieList(movies=movies, degraded=False)
        local = (
            Movie.objects.exclude(poster_path="")
            .filter(vote_count__gte=WELL_KNOWN_MIN_VOTES)
            .order_by("-popularity", "id")[:HOME_LIST_SIZE]
        )
        return MovieList(movies=list(local), degraded=True)

    def mood(self, slug: str, page: int = 1) -> MovieList:
        """Movies for a Home mood (apps/movies/moods.py), from TMDB discover with cache.
        Unknown slug → `MoodNotFound`. If TMDB fails with no cache, well-voted local
        movies of the mood's genres (first page only), flagged as degraded."""
        mood = MOODS.get(slug)
        if mood is None:
            raise MoodNotFound()
        page = max(1, min(page, MOOD_MAX_PAGE))
        params = {**BASE_PARAMS, **mood.params}
        # The filters are part of the key: editing a mood in moods.py invalidates its cache.
        filters = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        key = f"mood:{slug}:{page}:{filters}"
        cached = self.cached_lists({key: lambda client: client.discover_movies(params, page=page)})
        movies = [m for m in cached.lists.get(key, []) if m.poster_path]
        if key not in cached.failed:
            return MovieList(
                movies=movies,
                degraded=False,
                page=page,
                has_more=page < MOOD_MAX_PAGE and len(movies) >= HOME_LIST_SIZE - 2,
            )
        local = (
            Movie.objects.filter(genres__tmdb_id__in=mood.fallback_genres, vote_count__gte=400)
            .exclude(poster_path="")
            .distinct()
            .order_by("-popularity", "id")[:HOME_LIST_SIZE]
        )
        return MovieList(movies=list(local) if page == 1 else [], degraded=True, page=page)

    # ------------------------------------------------------------ onboarding

    def onboarding_sample(
        self,
        prefer_genre_ids: list[int],
        avoid_genre_ids: list[int],
        exclude_movie_ids: list[int],
        limit: int,
    ) -> list[Movie]:
        """Well-known titles for the onboarding's quick rating (not a recommendation).

        Titles sharing more of the preferred genres come first, then the most voted ones;
        titles in avoided genres are skipped. When the local catalog has too few well-known
        movies, TMDB's most voted list is cached first (if TMDB fails, the local pool is used).
        """
        pool = Movie.objects.filter(vote_count__gte=WELL_KNOWN_MIN_VOTES).exclude(poster_path="")
        if pool.count() < limit * 2:
            self._cache_well_known_movies()
        candidates = (
            pool.exclude(pk__in=exclude_movie_ids)
            .exclude(genres__in=avoid_genre_ids)
            .annotate(matches=Count("genres", filter=Q(genres__in=prefer_genre_ids), distinct=True))
            .order_by("-matches", "-vote_count", "id")
        )
        return list(candidates[:limit])

    def _cache_well_known_movies(self) -> None:
        for page in range(1, WELL_KNOWN_TMDB_PAGES + 1):
            try:
                payload = self.client.get_most_voted_movies(page=page)
            except TMDBError as exc:
                logger.warning("Could not load TMDB most voted movies: %r", exc)
                return
            results = [r for r in payload.get("results") or [] if isinstance(r.get("id"), int)]
            self._upsert_summaries(results)

    # ------------------------------------------------------------ internals

    @staticmethod
    def _is_stale(synced_at: datetime | None, max_age: timedelta | None = None) -> bool:
        if synced_at is None:
            return True
        return timezone.now() - synced_at > (max_age or timedelta(days=settings.TMDB_CACHE_DAYS))

    def _apply_details(self, movie: Movie, payload: dict[str, Any]) -> None:
        genres = self._upsert_genres(normalize_genres(payload.get("genres") or []))
        movie.metadata_synced_at = timezone.now()
        movie.save()
        movie.genres.set(genres.values())

    @staticmethod
    def _upsert_genres(genres: dict[int, str]) -> dict[int, Genre]:
        if not genres:
            return {}
        existing = Genre.objects.in_bulk(genres.keys(), field_name="tmdb_id")
        changed = [g for tid, g in existing.items() if g.name != genres[tid]]
        for genre in changed:
            genre.name = genres[genre.tmdb_id]
        Genre.objects.bulk_update(changed, ["name"])
        Genre.objects.bulk_create(
            [Genre(tmdb_id=tid, name=name) for tid, name in genres.items() if tid not in existing],
            ignore_conflicts=True,
        )
        return Genre.objects.in_bulk(genres.keys(), field_name="tmdb_id")

    @staticmethod
    def _upsert_people(credits: list[PersonCredit]) -> dict[int, Person]:
        by_id = {c.tmdb_id: c for c in credits}
        existing = Person.objects.in_bulk(by_id.keys(), field_name="tmdb_id")
        changed = []
        for tmdb_id, person in existing.items():
            credit = by_id[tmdb_id]
            if (person.name, person.profile_path) != (credit.name, credit.profile_path):
                person.name, person.profile_path = credit.name, credit.profile_path
                changed.append(person)
        Person.objects.bulk_update(changed, ["name", "profile_path"])
        Person.objects.bulk_create(
            [
                Person(tmdb_id=c.tmdb_id, name=c.name, profile_path=c.profile_path)
                for c in by_id.values()
                if c.tmdb_id not in existing
            ],
            ignore_conflicts=True,
        )
        return Person.objects.in_bulk(by_id.keys(), field_name="tmdb_id")

    def _upsert_summaries(self, results: list[dict[str, Any]]) -> list[Movie]:
        """Persist search results without duplicates; returns movies in TMDB order."""
        if not results:
            return []
        self.ensure_genre_catalog()
        payload_by_id = {r["id"]: r for r in results}
        with transaction.atomic():
            existing = Movie.objects.in_bulk(payload_by_id.keys(), field_name="tmdb_id")
            for tmdb_id, movie in existing.items():
                fresh = normalize_movie(payload_by_id[tmdb_id])
                for field in SEARCH_REFRESH_FIELDS:
                    setattr(movie, field, fresh[field])
            Movie.objects.bulk_update(existing.values(), SEARCH_REFRESH_FIELDS)

            new_ids = [tid for tid in payload_by_id if tid not in existing]
            Movie.objects.bulk_create(
                [Movie(tmdb_id=tid, **normalize_movie(payload_by_id[tid])) for tid in new_ids],
                ignore_conflicts=True,
            )
            movies = Movie.objects.in_bulk(payload_by_id.keys(), field_name="tmdb_id")
            self._link_search_genres(
                [movies[tid] for tid in new_ids if tid in movies], payload_by_id
            )
        return [movies[tid] for tid in payload_by_id if tid in movies]

    @staticmethod
    def _link_search_genres(movies: list[Movie], payload_by_id: dict[int, dict]) -> None:
        genres = Genre.objects.in_bulk(field_name="tmdb_id")
        through = Movie.genres.through
        links = [
            through(movie_id=movie.pk, genre_id=genres[gid].pk)
            for movie in movies
            for gid in genre_tmdb_ids(payload_by_id[movie.tmdb_id])
            if gid in genres
        ]
        through.objects.bulk_create(links, ignore_conflicts=True)

    @staticmethod
    def _load_credits(movie: Movie) -> MovieCredits:
        credits = list(MoviePerson.objects.filter(movie=movie).select_related("person"))
        role = MoviePerson.RoleType
        return MovieCredits(
            directors=[c for c in credits if c.role_type == role.DIRECTOR],
            cast=[c for c in credits if c.role_type == role.ACTOR][:CAST_RESPONSE_LIMIT],
        )
