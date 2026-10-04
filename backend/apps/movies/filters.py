"""Catalog filters of Buscar and Descubrir: genres, decade, minimum rating and runtime.

Without a text query they become TMDB `/discover/movie` params (`discover_params`); with a
query, TMDB's search has no filters, so the results are filtered here (`matches`).
Genres are local ids (the ones `/preferences/options` returns); several genres mean ALL of
them (TMDB's "," in `with_genres`).
"""

from dataclasses import dataclass, field
from typing import Any

from .models import Movie

DECADES = list(range(1950, 2030, 10))  # 1950 = "los 50"; same choices as the onboarding
MIN_RATINGS = [6, 7, 8]
RUNTIMES = [90, 120]  # "menos de 90 min", "menos de 2 h"
# A rating filter only counts titles enough people voted (a 9.5 with 3 votes is noise).
RATED_MIN_VOTES = 50
# Discover without filters on votes would surface obscure titles first.
DISCOVER_MIN_VOTES = 50


@dataclass(frozen=True)
class MovieFilters:
    genre_tmdb_ids: tuple[int, ...] = field(default_factory=tuple)
    decade: int | None = None
    min_rating: int | None = None
    max_runtime: int | None = None  # exclusive: the runtime must be lower

    @property
    def active(self) -> bool:
        return bool(self.genre_tmdb_ids) or any(
            value is not None for value in (self.decade, self.min_rating, self.max_runtime)
        )

    @property
    def key(self) -> str:
        """Stable text form, for logs and cache keys."""
        genres = ",".join(str(g) for g in sorted(self.genre_tmdb_ids))
        return f"g={genres}&d={self.decade}&r={self.min_rating}&t={self.max_runtime}"

    def discover_params(self) -> dict[str, Any]:
        params: dict[str, Any] = {
            "sort_by": "popularity.desc",
            "vote_count.gte": DISCOVER_MIN_VOTES,
        }
        if self.genre_tmdb_ids:
            params["with_genres"] = ",".join(str(g) for g in self.genre_tmdb_ids)
        if self.decade is not None:
            params["primary_release_date.gte"] = f"{self.decade}-01-01"
            params["primary_release_date.lte"] = f"{self.decade + 9}-12-31"
        if self.min_rating is not None:
            params["vote_average.gte"] = self.min_rating
            params["vote_count.gte"] = max(DISCOVER_MIN_VOTES, RATED_MIN_VOTES)
        if self.max_runtime is not None:
            params["with_runtime.gte"] = 1  # unknown runtimes come as 0
            params["with_runtime.lte"] = self.max_runtime - 1
        return params

    def matches(self, movie: Movie) -> bool:
        """For search results. The movie's genres must be prefetched; a runtime filter
        needs the full details (summaries have no runtime) and skips unknown runtimes."""
        if self.genre_tmdb_ids:
            genres = {genre.tmdb_id for genre in movie.genres.all()}
            if not set(self.genre_tmdb_ids) <= genres:
                return False
        if self.decade is not None:
            year = movie.release_year
            if year is None or not self.decade <= year < self.decade + 10:
                return False
        if self.min_rating is not None and (
            movie.vote_average < self.min_rating or movie.vote_count < RATED_MIN_VOTES
        ):
            return False
        return self.max_runtime is None or bool(movie.runtime and movie.runtime < self.max_runtime)
