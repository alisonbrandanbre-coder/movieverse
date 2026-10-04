"""Surprise mode (EPIC 4): GET /recommendations/surprise deals three different movies."""

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
    items = response.json()["items"]
    assert len(items) == 3
    for item in items:
        assert set(item) == {"movie", "section", "popularity_bucket", "explanation"}
        assert set(item["movie"]) >= {"id", "title", "poster_url", "release_year", "vote_average"}
        assert item["explanation"].strip()


def test_never_the_number_one_and_only_among_the_best_twenty(scifi_user, catalog, tmdb):
    rows = ranked(scifi_user)
    best_twenty = {r.movie_id for r in rows[1:20]}
    rng = random.Random(7)

    picks = {
        row.movie_id
        for _ in range(60)
        for row in RecommendationService().surprise(scifi_user, rng=rng)
    }

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
        row.movie_id
        for _ in range(60)
        for row in RecommendationService().surprise(
            scifi_user, exclude=frozenset({previous}), rng=rng
        )
    }

    assert not picks & {previous, watched, rejected}


def test_lesser_known_titles_are_favored(scifi_user, catalog, tmdb):
    rows = ranked(scifi_user)[1 : service.SURPRISE_POOL]
    lesser = {r.movie_id for r in rows if r.popularity_bucket in service.LESSER_KNOWN}
    assert lesser and len(lesser) < len(rows)  # both kinds in the pool
    rng = random.Random(11)

    # The first card of each batch: a plain weighted draw (the next ones also vary genres).
    counts = Counter(
        RecommendationService().surprise(scifi_user, rng=rng)[0].movie_id for _ in range(600)
    )

    share_in_pool = len(lesser) / len(rows)
    share_picked = sum(n for movie_id, n in counts.items() if movie_id in lesser) / 600
    assert share_picked > share_in_pool


def test_three_different_movies_every_time(scifi_user, catalog, tmdb):
    rng = random.Random(5)

    for _ in range(50):
        batch = RecommendationService().surprise(scifi_user, rng=rng)
        assert len(batch) == 3
        assert len({row.movie_id for row in batch}) == 3


def test_previous_batch_is_excluded_through_the_api(auth_client, scifi_user, catalog, tmdb):
    first = {item["movie"]["id"] for item in auth_client.get(URL).json()["items"]}
    assert len(first) == 3

    exclude = ",".join(str(i) for i in sorted(first))
    for _ in range(15):
        items = auth_client.get(URL, {"exclude": exclude}).json()["items"]
        ids = {item["movie"]["id"] for item in items}
        assert len(ids) == 3
        assert not ids & first


def test_cards_have_different_genres_when_possible(user, genres, onboard, tmdb):
    onboard(user, preferred=[genres["Ciencia ficción"], genres["Comedia"], genres["Terror"]])
    for name in ("Ciencia ficción", "Comedia", "Terror"):
        for i in range(6):
            make_movie(
                f"{name} {i}",
                genres=[genres[name]],
                vote_count=[9_000, 2_500, 600][i % 3],
                vote_average=7.4 + (i % 3) * 0.2,
                release_date=f"{2000 + i}-03-01",
            )
    rng = random.Random(9)

    for _ in range(40):
        batch = RecommendationService().surprise(user, rng=rng)
        batch_genres = [set(row.movie.genres.values_list("pk", flat=True)) for row in batch]
        assert len(batch) == 3
        assert not batch_genres[0] & batch_genres[1]
        assert not batch_genres[0] & batch_genres[2]
        assert not batch_genres[1] & batch_genres[2]


def test_fewer_than_three_left_returns_what_there_is(scifi_user, genres, tmdb):
    for i in range(3):
        make_movie(
            f"Sola {i}", genres=[genres["Ciencia ficción"]], vote_count=3000, vote_average=7.5
        )

    batch = RecommendationService().surprise(scifi_user)  # 3 recommendations, minus the #1

    assert len(batch) == 2


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
    mine = auth_client.get(URL).json()["items"][0]["movie"]["id"]
    Interaction.objects.create(user=scifi_user, movie_id=mine, type="WATCHED")

    # The other user (no onboarding) gets a surprise from their own fallback list.
    assert other_client.get(URL).status_code in (200, 404)
    assert mine not in {i["movie"]["id"] for i in auth_client.get(URL).json()["items"]}
