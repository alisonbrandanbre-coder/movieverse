from unittest.mock import MagicMock

import pytest

from apps.movies.services import movie_service
from apps.movies.services.tmdb_client import TMDBClient
from apps.preferences.services import TasteProfileService
from tests.factories import make_genre


@pytest.fixture
def tmdb(monkeypatch) -> MagicMock:
    """TMDB answering empty lists: candidates come from the local catalog unless a test says so."""
    mock = MagicMock(spec=TMDBClient)
    mock.get_genres.return_value = []
    mock.discover_movies.return_value = {"page": 1, "results": []}
    mock.get_movie_recommendations.return_value = {"page": 1, "results": []}
    mock.get_similar_movies.return_value = {"page": 1, "results": []}
    mock.get_movie_credits.return_value = {"cast": [], "crew": []}
    monkeypatch.setattr(movie_service, "TMDBClient", lambda: mock)
    return mock


@pytest.fixture
def genres(db):
    return {
        name: make_genre(name, tmdb_id=tmdb_id)
        for name, tmdb_id in [
            ("Ciencia ficción", 878),
            ("Suspense", 53),
            ("Comedia", 35),
            ("Terror", 27),
            ("Drama", 18),
            ("Aventura", 12),
        ]
    }


@pytest.fixture
def onboard():
    def _onboard(user, preferred, disliked=(), level="BALANCED", decades=(), languages=()):
        TasteProfileService.complete_onboarding(
            user,
            {
                "preferred_genres": [g.pk for g in preferred],
                "disliked_genres": [g.pk for g in disliked],
                "preferred_decades": list(decades),
                "preferred_languages": list(languages),
                "discovery_level": level,
            },
            [],
        )

    return _onboard
