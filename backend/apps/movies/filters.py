"""Catalog filters of Buscar and Descubrir (docs/API_GUIDELINES.md → "Filtros del catálogo").

Genres, decade, minimum rating, runtime range, streaming platforms (TMDB watch providers of
`TMDB_WATCH_REGION`), country of origin, popularity and sort order.

Without a text query they become TMDB `/discover/movie` params (`discover_params`); with a
query, TMDB's search has no filters, so the results are filtered (`matches`) and sorted
(`sort_movies`) here. Genres are local ids (the ones `/preferences/options` returns);
several genres mean ALL of them (TMDB's ","), several platforms or countries mean ANY (`|`).
"""

from dataclasses import dataclass, field, replace
from datetime import date
from typing import Any

from django.conf import settings

from apps.recommendations.models import PopularityBucket
from apps.recommendations.services.scoring import BUCKET_THRESHOLDS, popularity_bucket

from .models import Movie

DECADES = list(range(1950, 2030, 10))  # 1950 = "los 50"; same choices as the onboarding
MIN_RATINGS = [6, 7, 8]
# A rating filter (or sorting by rating) only counts titles enough people voted: a 9.5
# with 3 votes is noise.
RATED_MIN_VOTES = 100
# Discover without filters on votes would surface obscure titles first.
DISCOVER_MIN_VOTES = 50

# Runtime ranges in minutes, both ends included (None = open).
RUNTIME_RANGES: dict[str, tuple[int | None, int | None]] = {
    "short": (None, 89),  # Cortas: < 90
    "normal": (90, 119),  # Normales: 90–120
    "long": (120, 150),  # Largas: 120–150
    "epic": (151, None),  # Épicas: > 150
}

# Countries of origin offered by the filter (ISO 3166-1), plus "OTHER" = none of them.
COUNTRIES = ["AR", "US", "GB", "FR", "ES", "IT", "KR", "JP", "MX"]
OTHER_COUNTRY = "OTHER"
# TMDB discover cannot negate a country, so "Otros" asks for these (the most frequent
# origins outside the list). Search results use the exact rule: any country not listed.
OTHER_COUNTRIES = [
    "DE", "CA", "AU", "IN", "CN", "HK", "TW", "BR", "CL", "CO", "UY", "PE", "SE", "DK",
    "NO", "FI", "BE", "NL", "IE", "PL", "RU", "TR", "IR", "TH", "NZ", "PT", "AT", "CH",
]  # fmt: skip

# Popularity reuses the recommender's buckets (vote_count thresholds in scoring.py).
_BUCKET_MIN_VOTES = {bucket: votes for votes, bucket in BUCKET_THRESHOLDS}
POPULARITY_BUCKETS: dict[str, set[str]] = {
    "hidden": {PopularityBucket.HIDDEN},  # Joyas ocultas
    "balanced": {PopularityBucket.MEDIUM, PopularityBucket.POPULAR},  # Equilibrado
    "blockbuster": {PopularityBucket.VERY_POPULAR},  # Taquilleras
}
POPULARITY_VOTES: dict[str, tuple[int | None, int | None]] = {
    "hidden": (None, _BUCKET_MIN_VOTES[PopularityBucket.MEDIUM] - 1),
    "balanced": (
        _BUCKET_MIN_VOTES[PopularityBucket.MEDIUM],
        _BUCKET_MIN_VOTES[PopularityBucket.VERY_POPULAR] - 1,
    ),
    "blockbuster": (_BUCKET_MIN_VOTES[PopularityBucket.VERY_POPULAR], None),
}

RELEVANCE = "relevance"
# Discover has no text, so "relevance" is TMDB's (trending) popularity; "popular" means the
# most known titles, measured by votes like the recommender does.
SORTS: dict[str, str] = {
    RELEVANCE: "popularity.desc",
    "rating": "vote_average.desc",
    "newest": "primary_release_date.desc",
    "oldest": "primary_release_date.asc",
    "popular": "vote_count.desc",
}
# Streaming = subscription, free or with ads (rent and buy are shown in the detail only).
STREAMING_MONETIZATION = "flatrate|free|ads"
MAX_PROVIDERS = 10


@dataclass(frozen=True)
class MovieFilters:
    genre_tmdb_ids: tuple[int, ...] = field(default_factory=tuple)
    decade: int | None = None
    min_rating: int | None = None
    runtime: str | None = None  # a key of RUNTIME_RANGES
    provider_ids: tuple[int, ...] = field(default_factory=tuple)  # TMDB provider ids
    countries: tuple[str, ...] = field(default_factory=tuple)  # COUNTRIES or OTHER_COUNTRY
    popularity: str | None = None  # a key of POPULARITY_BUCKETS
    sort: str = RELEVANCE

    @property
    def active(self) -> bool:
        """Some filter is set (the sort order alone is not a filter)."""
        return bool(self.genre_tmdb_ids or self.provider_ids or self.countries) or any(
            value is not None
            for value in (self.decade, self.min_rating, self.runtime, self.popularity)
        )

    @property
    def needs_details(self) -> bool:
        """Search results have no runtime nor countries: these filters need the details."""
        return self.runtime is not None or bool(self.countries)

    def without_costly(self) -> "MovieFilters":
        """The filters a search result can be checked against without extra TMDB calls."""
        return replace(self, runtime=None, countries=(), provider_ids=())

    def without_providers(self) -> "MovieFilters":
        return replace(self, provider_ids=())

    @property
    def key(self) -> str:
        """Stable text form, for logs and cache keys."""
        return "&".join(f"{k}={v}" for k, v in sorted(self.discover_params().items()))

    def discover_params(self) -> dict[str, Any]:
        min_votes = DISCOVER_MIN_VOTES
        if self.min_rating is not None or self.sort == "rating":
            min_votes = max(min_votes, RATED_MIN_VOTES)
        params: dict[str, Any] = {"sort_by": SORTS[self.sort]}
        if self.genre_tmdb_ids:
            params["with_genres"] = ",".join(str(g) for g in self.genre_tmdb_ids)
        if self.decade is not None:
            params["primary_release_date.gte"] = f"{self.decade}-01-01"
            params["primary_release_date.lte"] = f"{self.decade + 9}-12-31"
        if self.sort == "newest":  # announced titles would come first otherwise
            today = date.today().isoformat()
            params["primary_release_date.lte"] = min(
                params.get("primary_release_date.lte", today), today
            )
        if self.min_rating is not None:
            params["vote_average.gte"] = self.min_rating
        if self.runtime is not None:
            low, high = RUNTIME_RANGES[self.runtime]
            params["with_runtime.gte"] = low or 1  # unknown runtimes come as 0
            if high is not None:
                params["with_runtime.lte"] = high
        if self.provider_ids:
            params["with_watch_providers"] = "|".join(str(p) for p in self.provider_ids)
            params["watch_region"] = settings.TMDB_WATCH_REGION
            params["with_watch_monetization_types"] = STREAMING_MONETIZATION
        if self.countries:
            codes = [c for c in self.countries if c != OTHER_COUNTRY]
            if OTHER_COUNTRY in self.countries:
                codes += OTHER_COUNTRIES
            params["with_origin_country"] = "|".join(codes)
        if self.popularity is not None:
            low, high = POPULARITY_VOTES[self.popularity]
            min_votes = max(min_votes, low or 0)
            if high is not None:
                params["vote_count.lte"] = high
        params["vote_count.gte"] = min_votes
        return params

    def matches(self, movie: Movie) -> bool:
        """For search results. The movie's genres must be prefetched; runtime and country
        filters need the full details and provider filters the movie's watch providers
        (unknown values never pass)."""
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
        if self.popularity is not None and (
            popularity_bucket(movie.vote_count) not in POPULARITY_BUCKETS[self.popularity]
        ):
            return False
        if self.runtime is not None:
            low, high = RUNTIME_RANGES[self.runtime]
            runtime = movie.runtime
            if not runtime or (low and runtime < low) or (high and runtime > high):
                return False
        if self.countries and not self._country_matches(movie.origin_countries or []):
            return False
        return not self.provider_ids or bool(
            set(self.provider_ids) & set(streaming_provider_ids(movie))
        )

    def _country_matches(self, origins: list[str]) -> bool:
        if set(origins) & set(self.countries):
            return True
        return OTHER_COUNTRY in self.countries and any(c not in COUNTRIES for c in origins)

    def sort_movies(self, movies: list[Movie]) -> list[Movie]:
        """Search results in the chosen order; relevance keeps TMDB's order. By rating, the
        titles with too few votes go last (like discover, which leaves them out); by date,
        the ones with no date."""
        if self.sort == "rating":
            return sorted(
                movies,
                key=lambda m: (m.vote_count < RATED_MIN_VOTES, -m.vote_average, -m.vote_count),
            )
        if self.sort == "popular":
            return sorted(movies, key=lambda m: -m.vote_count)
        if self.sort in ("newest", "oldest"):
            dated = [m for m in movies if m.release_date]
            dated.sort(key=lambda m: m.release_date, reverse=self.sort == "newest")
            return dated + [m for m in movies if not m.release_date]
        return movies


def streaming_provider_ids(movie: Movie) -> list[int]:
    """TMDB ids of the platforms where the movie streams (its synced watch providers)."""
    block = movie.watch_providers or {}
    return [p["tmdb_id"] for p in block.get("streaming") or []]
