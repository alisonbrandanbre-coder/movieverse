"""Thin HTTP client for TMDB v3. The only module in MovieVerse that talks to TMDB.

It returns raw TMDB payloads (dicts) and translates every transport/HTTP failure into
a `TMDBError` subclass, so callers never see `requests` exceptions or tracebacks.
"""

import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class TMDBError(Exception):
    """Base class for TMDB failures."""


class TMDBUnavailable(TMDBError):
    """Timeout, network error, 5xx, invalid response or misconfiguration."""


class TMDBNotConfigured(TMDBUnavailable):
    """TMDB_API_KEY is missing."""


class TMDBAuthError(TMDBUnavailable):
    """TMDB rejected our credentials (401). Operator problem, not the user's."""


class TMDBNotFound(TMDBError):
    """The requested TMDB resource does not exist (404)."""


class TMDBRateLimited(TMDBError):
    """TMDB answered 429."""

    def __init__(self, retry_after: int | None = None):
        super().__init__("TMDB rate limit exceeded")
        self.retry_after = retry_after


class TMDBClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        language: str | None = None,
        timeout: float | None = None,
        session: requests.Session | None = None,
    ):
        self.api_key = api_key if api_key is not None else settings.TMDB_API_KEY
        self.base_url = (base_url or settings.TMDB_API_BASE_URL).rstrip("/")
        self.language = language or settings.TMDB_LANGUAGE
        self.timeout = timeout or settings.TMDB_TIMEOUT_SECONDS
        self.session = session or requests.Session()

    # ------------------------------------------------------------ public API

    def search_movies(self, query: str, page: int = 1) -> dict[str, Any]:
        return self._get("/search/movie", {"query": query, "page": page, "include_adult": "false"})

    def get_movie_details(self, tmdb_id: int) -> dict[str, Any]:
        return self._get(f"/movie/{int(tmdb_id)}")

    def get_movie_credits(self, tmdb_id: int) -> dict[str, Any]:
        return self._get(f"/movie/{int(tmdb_id)}/credits")

    def get_similar_movies(self, tmdb_id: int, page: int = 1) -> dict[str, Any]:
        """Movies TMDB considers similar (shared keywords/genres). Recommender + map."""
        return self._get(f"/movie/{int(tmdb_id)}/similar", {"page": page})

    def get_movie_recommendations(self, tmdb_id: int, page: int = 1) -> dict[str, Any]:
        """TMDB's "people who liked this also liked" list for a movie (recommender seeds)."""
        return self._get(f"/movie/{int(tmdb_id)}/recommendations", {"page": page})

    def discover_movies(self, params: dict[str, Any], page: int = 1) -> dict[str, Any]:
        """`/discover/movie` with arbitrary filters (genres, dates, language, votes, sort)."""
        return self._get("/discover/movie", {**params, "page": page, "include_adult": "false"})

    def get_most_voted_movies(self, page: int = 1) -> dict[str, Any]:
        """Most voted movies of all time: the titles most people can rate (onboarding)."""
        return self.discover_movies({"sort_by": "vote_count.desc"}, page=page)

    def get_genres(self) -> list[dict[str, Any]]:
        return self._get("/genre/movie/list").get("genres", [])

    # ------------------------------------------------------------ internals

    def _auth(self) -> tuple[dict[str, str], dict[str, str]]:
        """Support both a v4 read access token (JWT, Bearer) and a v3 api_key."""
        if not self.api_key:
            raise TMDBNotConfigured("TMDB_API_KEY is not configured")
        if self.api_key.startswith("eyJ"):
            return {"Authorization": f"Bearer {self.api_key}"}, {}
        return {}, {"api_key": self.api_key}

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        headers, auth_params = self._auth()
        query = {"language": self.language, **(params or {}), **auth_params}
        url = f"{self.base_url}{path}"
        try:
            response = self.session.get(
                url,
                params=query,
                headers={"Accept": "application/json", **headers},
                timeout=self.timeout,
            )
        except requests.Timeout as exc:
            logger.warning("TMDB timeout on %s", path)
            raise TMDBUnavailable("TMDB timeout") from exc
        except requests.RequestException as exc:
            logger.warning("TMDB network error on %s: %s", path, exc.__class__.__name__)
            raise TMDBUnavailable("TMDB network error") from exc

        self._raise_for_status(response, path)
        try:
            payload = response.json()
        except ValueError as exc:
            raise TMDBUnavailable("TMDB returned invalid JSON") from exc
        if not isinstance(payload, dict):
            raise TMDBUnavailable("TMDB returned an unexpected payload")
        return payload

    @staticmethod
    def _raise_for_status(response: requests.Response, path: str) -> None:
        status = response.status_code
        if status < 400:
            return
        if status == 401:
            logger.error("TMDB rejected the API key (401). Check TMDB_API_KEY.")
            raise TMDBAuthError("TMDB authentication failed")
        if status == 404:
            raise TMDBNotFound(path)
        if status == 429:
            retry_after = response.headers.get("Retry-After")
            logger.warning("TMDB rate limited on %s", path)
            raise TMDBRateLimited(
                int(retry_after) if retry_after and retry_after.isdigit() else None
            )
        logger.warning("TMDB error %s on %s", status, path)
        raise TMDBUnavailable(f"TMDB HTTP {status}")
