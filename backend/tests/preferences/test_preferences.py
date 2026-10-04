from unittest.mock import MagicMock

import pytest

from apps.interactions.models import Interaction
from apps.movies.services import movie_service
from apps.movies.services.tmdb_client import TMDBClient, TMDBUnavailable
from apps.preferences.models import UserTasteProfile
from tests.factories import make_genre, make_movie

pytestmark = pytest.mark.django_db

PREFERENCES_URL = "/api/v1/preferences"
ONBOARDING_URL = "/api/v1/preferences/onboarding"
OPTIONS_URL = "/api/v1/preferences/options"
SAMPLE_URL = "/api/v1/movies/onboarding-sample"


@pytest.fixture
def genres():
    return {
        name: make_genre(name)
        for name in ["Ciencia ficción", "Suspense", "Terror", "Comedia", "Drama"]
    }


@pytest.fixture
def tmdb(monkeypatch) -> MagicMock:
    mock = MagicMock(spec=TMDBClient)
    mock.get_genres.return_value = []
    mock.get_most_voted_movies.return_value = {"page": 1, "results": []}
    monkeypatch.setattr(movie_service, "TMDBClient", lambda: mock)
    return mock


def onboarding_payload(genres, **overrides):
    return {
        "preferred_genres": [genres["Ciencia ficción"].id, genres["Suspense"].id],
        "disliked_genres": [genres["Terror"].id],
        "preferred_decades": [2000, 1990],
        "preferred_languages": ["en", "es"],
        "discovery_level": "EXPLORER",
        **overrides,
    }


# ================================================================ auth


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("get", PREFERENCES_URL),
        ("put", PREFERENCES_URL),
        ("post", ONBOARDING_URL),
        ("get", OPTIONS_URL),
        ("get", SAMPLE_URL),
    ],
)
def test_preference_endpoints_require_authentication(api_client, method, url):
    response = getattr(api_client, method)(url, {}, format="json")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"
    assert UserTasteProfile.objects.count() == 0


# ================================================================ GET /preferences


def test_new_user_has_empty_preferences_and_pending_onboarding(auth_client, user):
    response = auth_client.get(PREFERENCES_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["onboarding_completed"] is False
    assert body["preferred_genres"] == []
    assert body["disliked_genres"] == []
    assert body["preferred_decades"] == []
    assert body["preferred_languages"] == []
    assert body["discovery_level"] == "BALANCED"
    assert UserTasteProfile.objects.filter(user=user).count() == 1


# ================================================================ onboarding


def test_onboarding_saves_every_preference(auth_client, user, genres):
    response = auth_client.post(ONBOARDING_URL, onboarding_payload(genres), format="json")

    assert response.status_code == 200
    body = response.json()
    assert body["onboarding_completed"] is True
    assert {g["name"] for g in body["preferred_genres"]} == {"Ciencia ficción", "Suspense"}
    assert [g["name"] for g in body["disliked_genres"]] == ["Terror"]
    assert body["preferred_decades"] == [1990, 2000]
    assert body["preferred_languages"] == ["en", "es"]
    assert body["discovery_level"] == "EXPLORER"

    profile = UserTasteProfile.objects.get(user=user)
    assert profile.onboarding_completed is True
    assert set(profile.preferred_genres.values_list("name", flat=True)) == {
        "Ciencia ficción",
        "Suspense",
    }
    assert list(profile.disliked_genres.values_list("name", flat=True)) == ["Terror"]
    assert profile.preferred_decades == [1990, 2000]
    assert profile.preferred_languages == ["en", "es"]
    assert profile.discovery_level == "EXPLORER"
    # And it is what GET returns afterwards.
    assert auth_client.get(PREFERENCES_URL).json() == body


def test_onboarding_stores_quick_ratings_as_interactions(auth_client, user, genres):
    liked = make_movie("Interstellar")
    disliked = make_movie("Saw")

    response = auth_client.post(
        ONBOARDING_URL,
        onboarding_payload(
            genres,
            ratings=[
                {"movie_id": liked.id, "reaction": "LIKE"},
                {"movie_id": disliked.id, "reaction": "DISLIKE"},
            ],
        ),
        format="json",
    )

    assert response.status_code == 200
    stored = set(Interaction.objects.filter(user=user).values_list("movie__title", "type"))
    assert stored == {("Interstellar", "LIKE"), ("Saw", "DISLIKE")}


def test_onboarding_defaults_optional_fields(auth_client, genres):
    response = auth_client.post(
        ONBOARDING_URL, {"preferred_genres": [genres["Drama"].id]}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["discovery_level"] == "BALANCED"
    assert body["disliked_genres"] == []
    assert body["preferred_decades"] == []


def test_onboarding_deduplicates_values(auth_client, genres):
    drama = genres["Drama"].id
    response = auth_client.post(
        ONBOARDING_URL,
        {
            "preferred_genres": [drama, drama],
            "preferred_decades": [1990, 1990],
            "preferred_languages": ["en", "en"],
        },
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["preferred_genres"]) == 1
    assert body["preferred_decades"] == [1990]
    assert body["preferred_languages"] == ["en"]


def test_repeating_onboarding_replaces_preferences(auth_client, user, genres):
    auth_client.post(ONBOARDING_URL, onboarding_payload(genres), format="json")
    auth_client.post(
        ONBOARDING_URL,
        {"preferred_genres": [genres["Comedia"].id], "discovery_level": "FAMILIAR"},
        format="json",
    )

    profile = UserTasteProfile.objects.get(user=user)
    assert list(profile.preferred_genres.values_list("name", flat=True)) == ["Comedia"]
    assert profile.disliked_genres.count() == 0
    assert profile.discovery_level == "FAMILIAR"
    assert UserTasteProfile.objects.filter(user=user).count() == 1


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"preferred_genres": []}, "preferred_genres"),
        ({"preferred_genres": [999_999]}, "preferred_genres"),
        ({"disliked_genres": [999_999]}, "disliked_genres"),
        ({"preferred_decades": [1995]}, "preferred_decades"),
        ({"preferred_decades": [1800]}, "preferred_decades"),
        ({"preferred_languages": ["klingon"]}, "preferred_languages"),
        ({"discovery_level": "EXTREME"}, "discovery_level"),
        ({"ratings": [{"movie_id": 999_999, "reaction": "LIKE"}]}, "ratings"),
        ({"ratings": [{"movie_id": 1, "reaction": "FAVORITE"}]}, "ratings"),
    ],
)
def test_onboarding_rejects_invalid_values(auth_client, user, genres, override, field):
    response = auth_client.post(
        ONBOARDING_URL, onboarding_payload(genres, **override), format="json"
    )

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert field in error["details"]
    assert not UserTasteProfile.objects.filter(user=user, onboarding_completed=True).exists()


def test_onboarding_rejects_genre_both_preferred_and_disliked(auth_client, genres):
    scifi = genres["Ciencia ficción"].id
    response = auth_client.post(
        ONBOARDING_URL,
        onboarding_payload(genres, disliked_genres=[scifi]),
        format="json",
    )

    assert response.status_code == 400
    assert "disliked_genres" in response.json()["error"]["details"]


def test_onboarding_ignores_a_user_id_in_the_body(auth_client, user, other_user, genres):
    response = auth_client.post(
        ONBOARDING_URL, onboarding_payload(genres, user_id=other_user.id), format="json"
    )

    assert response.status_code == 200
    assert UserTasteProfile.objects.get(user=user).onboarding_completed is True
    assert not UserTasteProfile.objects.filter(user=other_user).exists()


# ================================================================ PUT /preferences


def test_put_updates_preferences_without_touching_onboarding_flag(auth_client, user, genres):
    auth_client.post(ONBOARDING_URL, onboarding_payload(genres), format="json")

    response = auth_client.put(
        PREFERENCES_URL,
        {
            "preferred_genres": [genres["Drama"].id],
            "disliked_genres": [],
            "preferred_decades": [1970],
            "preferred_languages": ["fr"],
            "discovery_level": "FAMILIAR",
        },
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert [g["name"] for g in body["preferred_genres"]] == ["Drama"]
    assert body["preferred_decades"] == [1970]
    assert body["preferred_languages"] == ["fr"]
    assert body["discovery_level"] == "FAMILIAR"
    assert body["onboarding_completed"] is True


def test_put_validates_like_onboarding(auth_client, genres):
    response = auth_client.put(PREFERENCES_URL, {"preferred_genres": []}, format="json")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# ================================================================ isolation


def test_users_never_see_each_others_preferences(auth_client, other_client, user, genres):
    auth_client.post(ONBOARDING_URL, onboarding_payload(genres), format="json")

    other = other_client.get(PREFERENCES_URL).json()
    assert other["onboarding_completed"] is False
    assert other["preferred_genres"] == []

    other_client.put(PREFERENCES_URL, {"preferred_genres": [genres["Comedia"].id]}, format="json")
    mine = auth_client.get(PREFERENCES_URL).json()
    assert {g["name"] for g in mine["preferred_genres"]} == {"Ciencia ficción", "Suspense"}


# ================================================================ options


def test_options_list_genres_decades_languages_and_levels(auth_client, genres, tmdb):
    response = auth_client.get(OPTIONS_URL)

    assert response.status_code == 200
    body = response.json()
    assert [g["name"] for g in body["genres"]] == sorted(g.name for g in genres.values())
    assert body["decades"][0] == 1950 and body["decades"][-1] == 2020
    assert {"code": "es", "name": "Español"} in body["languages"]
    assert [lvl["value"] for lvl in body["discovery_levels"]] == [
        "FAMILIAR",
        "BALANCED",
        "EXPLORER",
    ]
    assert [lvl["label"] for lvl in body["discovery_levels"]] == [
        "Familiar",
        "Equilibrado",
        "Explorador",
    ]
    tmdb.get_genres.assert_not_called()  # catalog already loaded


def test_options_load_genre_catalog_from_tmdb_when_empty(auth_client, tmdb):
    tmdb.get_genres.return_value = [{"id": 878, "name": "Ciencia ficción"}]

    body = auth_client.get(OPTIONS_URL).json()

    assert [g["name"] for g in body["genres"]] == ["Ciencia ficción"]


# ================================================================ onboarding sample


def test_sample_prioritizes_preferred_genres_and_skips_avoided(auth_client, genres, tmdb):
    scifi, horror, comedy = genres["Ciencia ficción"], genres["Terror"], genres["Comedia"]
    for i in range(30):  # big enough local pool: TMDB is not called
        make_movie(f"Comedia {i}", genres=[comedy], vote_count=50_000 - i)
    make_movie("Interstellar", genres=[scifi], vote_count=2000)
    make_movie("Saw", genres=[horror], vote_count=90_000)
    make_movie("Poco conocida", genres=[scifi], vote_count=10)
    make_movie("Sin póster", genres=[scifi], vote_count=90_000, poster=False)

    response = auth_client.get(SAMPLE_URL, {"genres": str(scifi.id), "avoid": str(horror.id)})

    assert response.status_code == 200
    titles = [m["title"] for m in response.json()["results"]]
    assert len(titles) == 12
    assert titles[0] == "Interstellar"
    assert "Saw" not in titles
    assert "Poco conocida" not in titles
    assert "Sin póster" not in titles
    assert set(response.json()["results"][0]) == {
        "id",
        "tmdb_id",
        "title",
        "release_year",
        "poster_url",
        "vote_average",
    }
    tmdb.get_most_voted_movies.assert_not_called()


def test_sample_excludes_movies_the_user_already_rated(auth_client, user, genres, tmdb):
    rated = make_movie("Ya valorada", vote_count=90_000)
    Interaction.objects.create(user=user, movie=rated, type="LIKE")
    make_movie("Nueva", vote_count=80_000)

    titles = [m["title"] for m in auth_client.get(SAMPLE_URL).json()["results"]]

    assert titles == ["Nueva"]


def test_sample_caches_tmdb_most_voted_when_local_pool_is_small(auth_client, tmdb):
    tmdb.get_most_voted_movies.return_value = {
        "page": 1,
        "results": [
            {
                "id": 27205,
                "title": "Inception",
                "release_date": "2010-07-15",
                "poster_path": "/inception.jpg",
                "vote_count": 38000,
                "vote_average": 8.4,
                "popularity": 90,
                "genre_ids": [],
            }
        ],
    }

    response = auth_client.get(SAMPLE_URL)

    assert response.status_code == 200
    assert [m["title"] for m in response.json()["results"]] == ["Inception"]
    assert tmdb.get_most_voted_movies.call_count == 2  # two pages


def test_sample_degrades_to_local_pool_when_tmdb_fails(auth_client, tmdb):
    tmdb.get_most_voted_movies.side_effect = TMDBUnavailable("down")
    make_movie("Local", vote_count=5000)

    response = auth_client.get(SAMPLE_URL)

    assert response.status_code == 200
    assert [m["title"] for m in response.json()["results"]] == ["Local"]


def test_sample_rejects_non_numeric_genre_ids(auth_client, tmdb):
    response = auth_client.get(SAMPLE_URL, {"genres": "abc"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
