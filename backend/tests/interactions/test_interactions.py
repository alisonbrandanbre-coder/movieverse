import pytest
from django.db import IntegrityError

from apps.interactions.models import Interaction
from tests.factories import make_movie

pytestmark = pytest.mark.django_db

FAVORITES_URL = "/api/v1/me/favorites"
WATCHLIST_URL = "/api/v1/me/watchlist"
WATCHED_URL = "/api/v1/me/watched"


def interactions_url(movie_id: int) -> str:
    return f"/api/v1/movies/{movie_id}/interactions"


def remove_url(movie_id: int, type_: str) -> str:
    return f"{interactions_url(movie_id)}/{type_}"


@pytest.fixture
def movie():
    return make_movie("Interstellar", release_date="2014-11-05", vote_average=8.4)


def add(client, movie_id: int, type_: str):
    return client.post(interactions_url(movie_id), {"type": type_}, format="json")


def types_of(user, movie) -> set[str]:
    return set(Interaction.objects.filter(user=user, movie=movie).values_list("type", flat=True))


# ================================================================ auth


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("get", interactions_url(1)),
        ("post", interactions_url(1)),
        ("delete", remove_url(1, "WATCHLIST")),
        ("get", FAVORITES_URL),
        ("get", WATCHLIST_URL),
        ("get", WATCHED_URL),
    ],
)
def test_interaction_endpoints_require_authentication(api_client, method, url):
    response = getattr(api_client, method)(url, {"type": "FAVORITE"}, format="json")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"
    assert Interaction.objects.count() == 0


# ================================================================ state


def test_state_of_untouched_movie(auth_client, movie):
    response = auth_client.get(interactions_url(movie.id))

    assert response.status_code == 200
    assert response.json() == {
        "movie_id": movie.id,
        "favorite": False,
        "watchlist": False,
        "watched": False,
        "reaction": None,
    }


@pytest.mark.parametrize(
    ("type_", "field", "expected"),
    [
        ("FAVORITE", "favorite", True),
        ("WATCHLIST", "watchlist", True),
        ("WATCHED", "watched", True),
        ("LIKE", "reaction", "LIKE"),
        ("DISLIKE", "reaction", "DISLIKE"),
    ],
)
def test_add_interaction_returns_new_state(auth_client, user, movie, type_, field, expected):
    response = add(auth_client, movie.id, type_)

    assert response.status_code == 200
    assert response.json()[field] == expected
    assert types_of(user, movie) == {type_}
    assert auth_client.get(interactions_url(movie.id)).json()[field] == expected


# ================================================================ no duplicates


@pytest.mark.parametrize("type_", ["WATCHLIST", "FAVORITE"])
def test_adding_twice_does_not_duplicate(auth_client, user, movie, type_):
    add(auth_client, movie.id, type_)
    second = add(auth_client, movie.id, type_)

    assert second.status_code == 200
    assert Interaction.objects.filter(user=user, movie=movie, type=type_).count() == 1
    listed = auth_client.get(WATCHLIST_URL if type_ == "WATCHLIST" else FAVORITES_URL).json()
    assert listed["total_results"] == 1


def test_database_rejects_duplicated_interactions(user, movie):
    Interaction.objects.create(user=user, movie=movie, type="WATCHLIST")

    with pytest.raises(IntegrityError):
        Interaction.objects.create(user=user, movie=movie, type="WATCHLIST")


# ================================================================ remove


def test_remove_from_watchlist(auth_client, user, movie):
    add(auth_client, movie.id, "WATCHLIST")

    response = auth_client.delete(remove_url(movie.id, "WATCHLIST"))

    assert response.status_code == 200
    assert response.json()["watchlist"] is False
    assert types_of(user, movie) == set()
    assert auth_client.get(WATCHLIST_URL).json()["results"] == []


def test_remove_watchlist_action_type(auth_client, user, movie):
    add(auth_client, movie.id, "WATCHLIST")

    response = add(auth_client, movie.id, "REMOVE_WATCHLIST")

    assert response.status_code == 200
    assert response.json()["watchlist"] is False
    assert Interaction.objects.filter(user=user).count() == 0  # the action is not stored


def test_remove_is_case_insensitive_and_idempotent(auth_client, movie):
    first = auth_client.delete(remove_url(movie.id, "favorite"))
    second = auth_client.delete(remove_url(movie.id, "favorite"))

    assert first.status_code == second.status_code == 200
    assert second.json()["favorite"] is False


@pytest.mark.parametrize("type_", ["REMOVE_WATCHLIST", "BOGUS"])
def test_remove_rejects_non_state_types(auth_client, movie, type_):
    response = auth_client.delete(remove_url(movie.id, type_))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INTERACTION"


# ================================================================ rules


def test_like_and_dislike_are_exclusive(auth_client, user, movie):
    add(auth_client, movie.id, "LIKE")
    response = add(auth_client, movie.id, "DISLIKE")

    assert response.json()["reaction"] == "DISLIKE"
    assert types_of(user, movie) == {"DISLIKE"}

    add(auth_client, movie.id, "LIKE")
    assert types_of(user, movie) == {"LIKE"}


def test_dislike_clears_favorite_and_watchlist(auth_client, user, movie):
    for type_ in ["FAVORITE", "WATCHLIST", "WATCHED"]:
        add(auth_client, movie.id, type_)

    body = add(auth_client, movie.id, "DISLIKE").json()

    assert body == {
        "movie_id": movie.id,
        "favorite": False,
        "watchlist": False,
        "watched": True,
        "reaction": "DISLIKE",
    }


def test_favorite_clears_dislike(auth_client, user, movie):
    add(auth_client, movie.id, "DISLIKE")
    add(auth_client, movie.id, "FAVORITE")

    assert types_of(user, movie) == {"FAVORITE"}


def test_marking_watched_removes_from_watchlist(auth_client, user, movie):
    add(auth_client, movie.id, "WATCHLIST")

    body = add(auth_client, movie.id, "WATCHED").json()

    assert body["watched"] is True
    assert body["watchlist"] is False
    assert types_of(user, movie) == {"WATCHED"}


# ================================================================ validation


@pytest.mark.parametrize("payload", [{}, {"type": "LOVE"}, {"type": ""}])
def test_add_rejects_invalid_types(auth_client, movie, payload):
    response = auth_client.post(interactions_url(movie.id), payload, format="json")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert Interaction.objects.count() == 0


def test_interactions_on_missing_movie_return_404(auth_client):
    for response in [
        auth_client.get(interactions_url(999_999)),
        add(auth_client, 999_999, "FAVORITE"),
        auth_client.delete(remove_url(999_999, "FAVORITE")),
    ]:
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "MOVIE_NOT_FOUND"


# ================================================================ isolation


def test_user_id_in_body_is_ignored(auth_client, user, other_user, movie):
    response = auth_client.post(
        interactions_url(movie.id), {"type": "FAVORITE", "user_id": other_user.id}, format="json"
    )

    assert response.status_code == 200
    assert types_of(user, movie) == {"FAVORITE"}
    assert types_of(other_user, movie) == set()


def test_users_never_see_each_others_lists(auth_client, other_client, movie):
    other_movie = make_movie("Inception")
    add(auth_client, movie.id, "FAVORITE")
    add(auth_client, movie.id, "WATCHLIST")
    add(auth_client, other_movie.id, "WATCHED")

    for url in [FAVORITES_URL, WATCHLIST_URL, WATCHED_URL]:
        body = other_client.get(url).json()
        assert body["results"] == []
        assert body["total_results"] == 0
    assert other_client.get(interactions_url(movie.id)).json()["favorite"] is False


def test_removing_only_affects_own_interactions(auth_client, other_client, user, movie):
    add(auth_client, movie.id, "WATCHLIST")

    other_client.delete(remove_url(movie.id, "WATCHLIST"))
    add(other_client, movie.id, "REMOVE_WATCHLIST")

    assert types_of(user, movie) == {"WATCHLIST"}


def test_same_movie_in_two_users_watchlists(auth_client, other_client, movie):
    add(auth_client, movie.id, "WATCHLIST")
    add(other_client, movie.id, "WATCHLIST")

    assert auth_client.get(WATCHLIST_URL).json()["total_results"] == 1
    assert other_client.get(WATCHLIST_URL).json()["total_results"] == 1
    assert Interaction.objects.filter(movie=movie, type="WATCHLIST").count() == 2


# ================================================================ lists


def test_lists_return_movie_summaries_newest_first(auth_client, movie):
    inception = make_movie("Inception")
    add(auth_client, movie.id, "FAVORITE")
    add(auth_client, inception.id, "FAVORITE")
    add(auth_client, inception.id, "WATCHLIST")

    body = auth_client.get(FAVORITES_URL).json()

    assert body["page"] == 1
    assert body["total_pages"] == 1
    assert body["total_results"] == 2
    assert [m["title"] for m in body["results"]] == ["Inception", "Interstellar"]
    first = body["results"][1]
    assert set(first) == {
        "id",
        "tmdb_id",
        "title",
        "release_year",
        "poster_url",
        "vote_average",
        "added_at",
    }
    assert first["release_year"] == 2014
    assert [m["title"] for m in auth_client.get(WATCHLIST_URL).json()["results"]] == ["Inception"]
    assert auth_client.get(WATCHED_URL).json()["results"] == []


def test_lists_are_paginated(auth_client):
    for i in range(30):
        add(auth_client, make_movie(f"Peli {i}").id, "WATCHED")

    first = auth_client.get(WATCHED_URL).json()
    second = auth_client.get(WATCHED_URL, {"page": 2}).json()

    assert first["total_results"] == 30
    assert first["total_pages"] == 2
    assert len(first["results"]) == 24
    assert len(second["results"]) == 6
    assert auth_client.get(WATCHED_URL, {"page": 0}).status_code == 400


def test_empty_list(auth_client):
    body = auth_client.get(FAVORITES_URL).json()

    assert body == {"page": 1, "total_pages": 0, "total_results": 0, "results": []}
