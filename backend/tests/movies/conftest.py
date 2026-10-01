from unittest.mock import MagicMock

import pytest

from apps.movies.services import movie_service
from apps.movies.services.tmdb_client import TMDBClient

from . import tmdb_payloads as payloads


@pytest.fixture
def tmdb(monkeypatch) -> MagicMock:
    """Mocked TMDBClient used by every MovieService built during the test."""
    mock = MagicMock(spec=TMDBClient)
    mock.search_movies.return_value = payloads.SEARCH_INTERSTELLAR
    mock.get_movie_details.return_value = payloads.INTERSTELLAR_DETAILS
    mock.get_movie_credits.return_value = payloads.INTERSTELLAR_CREDITS
    mock.get_genres.return_value = payloads.GENRES
    monkeypatch.setattr(movie_service, "TMDBClient", lambda: mock)
    return mock
