"""`manage.py seed_demo`: demo users ready for the first login (TMDB mocked)."""

from io import StringIO
from unittest.mock import MagicMock

import pytest
from django.core.management import CommandError, call_command

from apps.accounts.models import User
from apps.common.management.commands import seed_demo
from apps.interactions.models import Interaction
from apps.movies.services import movie_service
from apps.movies.services.tmdb_client import TMDBClient, TMDBUnavailable
from apps.preferences.models import UserTasteProfile
from apps.recommendations.models import RecommendationRun, RecommendationSnapshot

pytestmark = pytest.mark.django_db

GENRES = [
    {"id": 878, "name": "Ciencia ficción"},
    {"id": 53, "name": "Suspense"},
    {"id": 9648, "name": "Misterio"},
    {"id": 10749, "name": "Romance"},
    {"id": 35, "name": "Comedia"},
    {"id": 10751, "name": "Familia"},
    {"id": 27, "name": "Terror"},
]
SCIFI_IDS = {157336, 78, 329865, 603, 27205, 62, 17431, 264660, 782, 14337, 438631}


def details(tmdb_id: int) -> dict:
    genre = 878 if tmdb_id in SCIFI_IDS else 35
    return {
        "id": tmdb_id,
        "title": f"Película {tmdb_id}",
        "release_date": "2005-06-01",
        "vote_count": 8000,
        "vote_average": 7.6,
        "popularity": 30,
        "poster_path": f"/{tmdb_id}.jpg",
        "original_language": "en",
        "genres": [g for g in GENRES if g["id"] == genre],
    }


def discover(params, page=1):
    """A few well-rated candidates per genre, so recommendations are not empty."""
    genre = int(str(params.get("with_genres", "878")).split("|")[0].split(",")[0])
    return {
        "results": [
            {
                "id": genre * 1000 + i,
                "title": f"Candidata {genre}-{i}",
                "release_date": "2008-01-01",
                "vote_count": 3000 + i * 500,
                "vote_average": 7.4,
                "popularity": 20,
                "genre_ids": [genre],
                "poster_path": "/c.jpg",
                "original_language": "en",
            }
            for i in range(8)
        ]
    }


@pytest.fixture
def tmdb(monkeypatch) -> MagicMock:
    mock = MagicMock(spec=TMDBClient)
    mock.get_genres.return_value = GENRES
    mock.get_movie_details.side_effect = details
    mock.get_movie_credits.return_value = {"cast": [], "crew": []}
    mock.discover_movies.side_effect = discover
    mock.get_movie_recommendations.return_value = {"results": []}
    mock.get_similar_movies.return_value = {"results": []}
    monkeypatch.setattr(movie_service, "TMDBClient", lambda: mock)
    return mock


def run() -> str:
    out = StringIO()
    call_command("seed_demo", "--skip-warm", stdout=out)
    return out.getvalue()


def test_creates_two_users_with_opposite_tastes_and_finished_onboarding(tmdb):
    output = run()

    explorer = User.objects.get(email="explorador@movieverse.example")
    familiar = User.objects.get(email="familiar@movieverse.example")
    assert explorer.check_password(seed_demo.DEMO_PASSWORD)
    for user, level, liked, avoided in [
        (explorer, "EXPLORER", "Ciencia ficción", "Romance"),
        (familiar, "FAMILIAR", "Comedia", "Terror"),
    ]:
        profile = UserTasteProfile.objects.get(user=user)
        assert profile.onboarding_completed
        assert profile.discovery_level == level
        assert liked in {g.name for g in profile.preferred_genres.all()}
        assert avoided in {g.name for g in profile.disliked_genres.all()}
    assert "Contraseña de ambos usuarios" in output


def test_loads_favorites_watched_likes_and_recommendations(tmdb):
    run()

    for demo in seed_demo.DEMO_USERS:
        user = User.objects.get(email=demo.email)
        types = list(Interaction.objects.filter(user=user).values_list("type", flat=True))
        assert types.count("FAVORITE") == len(demo.favorites)
        assert types.count("WATCHED") == len(demo.watched)
        assert types.count("LIKE") == len(demo.likes)
        assert types.count("DISLIKE") == len(demo.dislikes)
        # Ready from the first login: generated now, never recommending what they marked.
        run_ = RecommendationRun.objects.get(user=user)
        assert run_.is_fallback is False
        recommended = set(
            RecommendationSnapshot.objects.filter(run=run_).values_list("movie_id", flat=True)
        )
        assert recommended
        assert not recommended & set(
            Interaction.objects.filter(user=user).values_list("movie_id", flat=True)
        )


def test_running_it_again_resets_the_same_state(tmdb):
    run()
    explorer = User.objects.get(email="explorador@movieverse.example")
    explorer.set_password("otra")
    explorer.save()
    Interaction.objects.filter(user=explorer, type="FAVORITE").delete()

    run()

    assert User.objects.filter(email__endswith="@movieverse.example").count() == 2
    explorer.refresh_from_db()
    assert explorer.check_password(seed_demo.DEMO_PASSWORD)
    assert Interaction.objects.filter(user=explorer, type="FAVORITE").count() == 3


def test_tmdb_down_is_a_clear_error(tmdb):
    tmdb.get_movie_details.side_effect = TMDBUnavailable("down")

    with pytest.raises(CommandError, match="TMDB no respondió"):
        run()
