"""Surprise mode (EPIC 4): GET /recommendations/surprise."""

import random
from collections import Counter

import pytest

from apps.interactions.models import Interaction
from apps.recommendations.models import RecommendationSnapshot
from apps.recommendations.services import recommendation_service as service
from apps.recommendations.services.recommendation_service import NoSurprise, RecommendationService
from tests.factories import make_movie

pytestmark = pytest.mark.django_db

URL = "/api/v1/recommendations/surprise"


@pytest.fixture
def catalog(genres):
    """30 well rated science fiction movies, from blockbusters to lesser-known ones."""
    scifi = genres["Ciencia ficción"]
    return [
        make_movie(
            f"Película {i:02d}",
            genres=[scifi],
            vote_count=[40_000, 9_000, 2_500, 600][i % 4],
            vote_average=7.2 + (i % 5) * 0.2,
            release_date=f"{1990 + i}-05-01",
        )
        for i in range(30)
    ]


@pytest.fixture
def scifi_user(user, genres, onboard):
    onboard(user, preferred=[genres["Ciencia ficción"]], level="EXPLORER")
    return user


def ranked(user) -> list[RecommendationSnapshot]:
    RecommendationService().get(user)
    return list(
        RecommendationSnapshot.objects.filter(user=user).order_by("-final_score", "movie_id")
    )


def test_requires_authentication(api_client):
    response = api_client.get(URL)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_response_shape(auth_client, scifi_user, catalog, tmdb):
    response = auth_client.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"movie", "section", "popularity_bucket", "explanation"}
    assert set(body["movie"]) >= {"id", "title", "poster_url", "release_year", "vote_average"}
    assert body["explanation"].strip()


def test_never_the_number_one_and_only_among_the_best_twenty(scifi_user, catalog, tmdb):
    rows = ranked(scifi_user)
    best_twenty = {r.movie_id for r in rows[1:20]}
    rng = random.Random(7)

    picks = {RecommendationService().surprise(scifi_user, rng=rng).movie_id for _ in range(120)}

    assert rows[0].movie_id not in picks
    assert picks <= best_twenty
    assert len(picks) > 5  # really random, not always the same


def test_never_watched_rejected_nor_the_previous_one(scifi_user, catalog, tmdb):
    rows = ranked(scifi_user)
    previous, watched, rejected = rows[1].movie_id, rows[2].movie_id, rows[3].movie_id
    # Marked after the recommendations were generated.
    Interaction.objects.create(user=scifi_user, movie_id=watched, type="WATCHED")
    Interaction.objects.create(user=scifi_user, movie_id=rejected, type="DISLIKE")
    rng = random.Random(3)

    picks = {
        RecommendationService()
        .surprise(scifi_user, exclude=frozenset({previous}), rng=rng)
        .movie_id
        for _ in range(120)
    }

    assert not picks & {previous, watched, rejected}


def test_lesser_known_titles_are_favored(scifi_user, catalog, tmdb):
    rows = ranked(scifi_user)[1 : service.SURPRISE_POOL]
    lesser = {r.movie_id for r in rows if r.popularity_bucket in service.LESSER_KNOWN}
    assert lesser and len(lesser) < len(rows)  # both kinds in the pool
    rng = random.Random(11)

    counts = Counter(
        RecommendationService().surprise(scifi_user, rng=rng).movie_id for _ in range(600)
    )

    share_in_pool = len(lesser) / len(rows)
    share_picked = sum(n for movie_id, n in counts.items() if movie_id in lesser) / 600
    assert share_picked > share_in_pool


def test_previous_is_excluded_through_the_api(auth_client, scifi_user, catalog, tmdb):
    first = auth_client.get(URL).json()["movie"]["id"]

    others = {auth_client.get(URL, {"exclude": first}).json()["movie"]["id"] for _ in range(20)}

    assert first not in others


def test_nothing_left_is_a_clear_404(auth_client, scifi_user, genres, tmdb):
    make_movie("Única", genres=[genres["Ciencia ficción"]], vote_count=3000, vote_average=7.5)

    response = auth_client.get(URL)  # only one recommendation: it is the #1

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NO_SURPRISE"
    with pytest.raises(NoSurprise):
        RecommendationService().surprise(scifi_user)


def test_rejects_invalid_exclude(auth_client, scifi_user, catalog, tmdb):
    response = auth_client.get(URL, {"exclude": "abc"})

    assert response.status_code == 400


def test_users_only_get_their_own_surprise(auth_client, other_client, scifi_user, catalog, tmdb):
    mine = auth_client.get(URL).json()["movie"]["id"]
    Interaction.objects.create(user=scifi_user, movie_id=mine, type="WATCHED")

    # The other user (no onboarding) gets a surprise from their own fallback list.
    assert other_client.get(URL).status_code in (200, 404)
    assert auth_client.get(URL).json()["movie"]["id"] != mine
