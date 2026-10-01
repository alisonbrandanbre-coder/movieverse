"""MovieService: the catalog's single entry point for views (and future Graph/Recommendation).

Cache policy (docs/SPRINT_1_REPORT.md → "Persistencia"):
- Search results are upserted as *summary* rows (no runtime, no credits).
- Full metadata and credits are fetched on first access and refreshed only when older
  than `TMDB_CACHE_DAYS`. If TMDB fails while refreshing, cached data is served.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from ..exceptions import CatalogRateLimited, CatalogUnavailable, MovieNotFound
from ..models import Genre, Movie, MoviePerson, Person
from .normalizers import (
    PersonCredit,
    genre_tmdb_ids,
    normalize_credits,
    normalize_genres,
    normalize_movie,
    normalize_movie_details,
)
from .tmdb_client import TMDBClient, TMDBError, TMDBNotFound, TMDBRateLimited

logger = logging.getLogger(__name__)

CAST_STORE_LIMIT = 15  # stored for the graph ("lead actors")
CAST_RESPONSE_LIMIT = 10  # returned by the credits endpoint
MAX_DB_ID = 2**63 - 1
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

    def search(self, query: str, page: int = 1) -> SearchResult:
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

    # ------------------------------------------------------------ single movie

    def get_movie(self, movie_id: int) -> Movie:
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
        credits = normalize_credits(
            self.client.get_movie_credits(movie.tmdb_id), cast_limit=CAST_STORE_LIMIT
        )
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

    # ------------------------------------------------------------ internals

    @staticmethod
    def _is_stale(synced_at: datetime | None) -> bool:
        if synced_at is None:
            return True
        return timezone.now() - synced_at > timedelta(days=settings.TMDB_CACHE_DAYS)

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
