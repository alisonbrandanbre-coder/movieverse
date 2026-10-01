from datetime import timedelta

import pytest
from django.utils import timezone

from apps.movies.models import Genre, Movie, MoviePerson, Person
from apps.movies.services.tmdb_client import (
    TMDBAuthError,
    TMDBNotFound,
    TMDBRateLimited,
    TMDBUnavailable,
)

from . import tmdb_payloads as payloads

pytestmark = pytest.mark.django_db

SEARCH_URL = "/api/v1/movies/search"


def detail_url(movie_id: int) -> str:
    return f"/api/v1/movies/{movie_id}"


def credits_url(movie_id: int) -> str:
    return f"/api/v1/movies/{movie_id}/credits"


@pytest.fixture
def interstellar(auth_client, tmdb) -> Movie:
    """Interstellar persisted as a search result (summary only)."""
    auth_client.get(SEARCH_URL, {"q": "interstellar"})
    return Movie.objects.get(tmdb_id=payloads.INTERSTELLAR_ID)


# ================================================================ search


def test_search_returns_persisted_results(auth_client, tmdb):
    response = auth_client.get(SEARCH_URL, {"q": "  interstellar  "})

    assert response.status_code == 200
    body = response.json()
    tmdb.search_movies.assert_called_once_with("interstellar", page=1)
    assert body["query"] == "interstellar"
    assert body["total_results"] == 2
    first = body["results"][0]
    movie = Movie.objects.get(tmdb_id=payloads.INTERSTELLAR_ID)
    assert first == {
        "id": movie.id,
        "tmdb_id": 157336,
        "title": "Interstellar",
        "release_year": 2014,
        "poster_url": "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        "vote_average": 8.4,
    }
    # Result without date/poster must still serialize cleanly.
    assert body["results"][1]["release_year"] is None
    assert body["results"][1]["poster_url"] is None


def test_search_links_genres_from_catalog(auth_client, tmdb):
    auth_client.get(SEARCH_URL, {"q": "interstellar"})

    movie = Movie.objects.get(tmdb_id=payloads.INTERSTELLAR_ID)
    assert set(movie.genres.values_list("tmdb_id", flat=True)) == {12, 18, 878}
    assert Genre.objects.count() == len(payloads.GENRES)
    # Unknown genre id (99) is ignored instead of failing.
    assert Movie.objects.get(tmdb_id=301959).genres.count() == 0


def test_search_twice_does_not_duplicate_movies(auth_client, tmdb):
    auth_client.get(SEARCH_URL, {"q": "interstellar"})
    updated = {
        **payloads.SEARCH_INTERSTELLAR,
        "results": [{**payloads.SEARCH_INTERSTELLAR["results"][0], "popularity": 999.0}],
    }
    tmdb.search_movies.return_value = updated

    auth_client.get(SEARCH_URL, {"q": "interstellar"})

    assert Movie.objects.count() == 2
    assert Movie.objects.get(tmdb_id=payloads.INTERSTELLAR_ID).popularity == 999.0
    tmdb.get_genres.assert_called_once()  # genre catalog is cached too


def test_search_with_no_results(auth_client, tmdb):
    tmdb.search_movies.return_value = payloads.SEARCH_EMPTY

    response = auth_client.get(SEARCH_URL, {"q": "zzzzzz"})

    assert response.status_code == 200
    assert response.json()["results"] == []
    assert response.json()["total_results"] == 0
    assert Movie.objects.count() == 0


@pytest.mark.parametrize("query", [None, "", "   ", "a", "x" * 101])
def test_search_rejects_invalid_queries(auth_client, tmdb, query):
    params = {} if query is None else {"q": query}

    response = auth_client.get(SEARCH_URL, params)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "q" in response.json()["error"]["details"]
    tmdb.search_movies.assert_not_called()


@pytest.mark.parametrize("page", ["0", "501", "abc"])
def test_search_rejects_invalid_page(auth_client, tmdb, page):
    response = auth_client.get(SEARCH_URL, {"q": "interstellar", "page": page})

    assert response.status_code == 400


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (TMDBUnavailable("timeout"), "TMDB_UNAVAILABLE"),
        (TMDBAuthError("401"), "TMDB_UNAVAILABLE"),
        (TMDBRateLimited(), "TMDB_RATE_LIMITED"),
    ],
)
def test_search_handles_tmdb_failures(auth_client, tmdb, error, code):
    tmdb.search_movies.side_effect = error

    response = auth_client.get(SEARCH_URL, {"q": "interstellar"})

    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == code
    assert "Traceback" not in str(body)


def test_search_survives_genre_list_failure(auth_client, tmdb):
    tmdb.get_genres.side_effect = TMDBUnavailable("down")

    response = auth_client.get(SEARCH_URL, {"q": "interstellar"})

    assert response.status_code == 200
    assert len(response.json()["results"]) == 2


def test_search_requires_authentication(api_client, tmdb):
    response = api_client.get(SEARCH_URL, {"q": "interstellar"})

    assert response.status_code == 401
    tmdb.search_movies.assert_not_called()


# ================================================================ detail


def test_detail_syncs_full_metadata_on_first_access(auth_client, tmdb, interstellar):
    assert interstellar.runtime is None

    response = auth_client.get(detail_url(interstellar.id))

    assert response.status_code == 200
    body = response.json()
    tmdb.get_movie_details.assert_called_once_with(payloads.INTERSTELLAR_ID)
    assert body["id"] == interstellar.id
    assert body["title"] == "Interstellar"
    assert body["original_title"] == "Interstellar"
    assert body["release_date"] == "2014-11-05"
    assert body["release_year"] == 2014
    assert body["runtime"] == 169
    assert body["original_language"] == "en"
    assert body["vote_count"] == 35000
    assert body["backdrop_url"].startswith("https://image.tmdb.org/t/p/w1280/")
    assert sorted(g["name"] for g in body["genres"]) == ["Adventure", "Drama", "Science Fiction"]


def test_detail_uses_cache_when_fresh(auth_client, tmdb, interstellar):
    auth_client.get(detail_url(interstellar.id))
    auth_client.get(detail_url(interstellar.id))

    assert tmdb.get_movie_details.call_count == 1
    assert Movie.objects.count() == 2


def test_detail_refreshes_when_stale(auth_client, tmdb, interstellar, settings):
    auth_client.get(detail_url(interstellar.id))
    Movie.objects.filter(pk=interstellar.pk).update(
        metadata_synced_at=timezone.now() - timedelta(days=settings.TMDB_CACHE_DAYS + 1)
    )

    auth_client.get(detail_url(interstellar.id))

    assert tmdb.get_movie_details.call_count == 2


def test_detail_serves_cached_data_when_tmdb_fails(auth_client, tmdb, interstellar):
    tmdb.get_movie_details.side_effect = TMDBUnavailable("timeout")

    response = auth_client.get(detail_url(interstellar.id))

    assert response.status_code == 200
    assert response.json()["title"] == "Interstellar"
    assert response.json()["runtime"] is None


def test_detail_of_nonexistent_movie_returns_404(auth_client, tmdb):
    response = auth_client.get(detail_url(999999))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "MOVIE_NOT_FOUND"
    tmdb.get_movie_details.assert_not_called()


def test_detail_with_out_of_range_id_returns_404(auth_client, tmdb):
    assert auth_client.get(detail_url(2**64)).status_code == 404


def test_detail_with_non_numeric_id_returns_404(auth_client, tmdb):
    assert auth_client.get("/api/v1/movies/abc").status_code == 404


def test_detail_requires_authentication(api_client, db):
    assert api_client.get(detail_url(1)).status_code == 401


# ================================================================ credits


def test_credits_returns_directors_and_top_10_cast(auth_client, tmdb, interstellar):
    response = auth_client.get(credits_url(interstellar.id))

    assert response.status_code == 200
    body = response.json()
    nolan = Person.objects.get(tmdb_id=525)
    assert body["directors"] == [
        {
            "id": nolan.id,
            "tmdb_id": 525,
            "name": "Christopher Nolan",
            "profile_url": "https://image.tmdb.org/t/p/w185/nolan.jpg",
        }
    ]
    assert len(body["cast"]) == 10
    assert body["cast"][0]["name"] == "Matthew McConaughey"
    assert body["cast"][0]["character"] == "Cooper"
    assert [c["order"] for c in body["cast"]] == list(range(10))


def test_credits_are_persisted_for_graph(auth_client, tmdb, interstellar):
    auth_client.get(credits_url(interstellar.id))

    directors = MoviePerson.objects.filter(movie=interstellar, role_type="DIRECTOR")
    actors = MoviePerson.objects.filter(movie=interstellar, role_type="ACTOR")
    assert directors.count() == 1  # Nolan as Writer is not stored as director
    assert actors.count() == 15  # CAST_STORE_LIMIT
    assert actors.filter(person__tmdb_id=10297).count() == 1  # duplicated actor deduped
    assert not Person.objects.filter(name="Emma Thomas").exists()  # producers ignored


def test_credits_are_cached_and_not_duplicated(auth_client, tmdb, interstellar):
    auth_client.get(credits_url(interstellar.id))
    auth_client.get(credits_url(interstellar.id))

    assert tmdb.get_movie_credits.call_count == 1
    assert MoviePerson.objects.filter(movie=interstellar).count() == 16


def test_credits_resync_replaces_rows(auth_client, tmdb, interstellar):
    auth_client.get(credits_url(interstellar.id))
    Movie.objects.filter(pk=interstellar.pk).update(credits_synced_at=None)

    auth_client.get(credits_url(interstellar.id))

    assert tmdb.get_movie_credits.call_count == 2
    assert MoviePerson.objects.filter(movie=interstellar).count() == 16
    assert Person.objects.filter(tmdb_id=525).count() == 1


def test_credits_tmdb_failure_without_cache_returns_503(auth_client, tmdb, interstellar):
    tmdb.get_movie_credits.side_effect = TMDBUnavailable("timeout")

    response = auth_client.get(credits_url(interstellar.id))

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "TMDB_UNAVAILABLE"


def test_credits_tmdb_failure_with_stale_cache_serves_cache(auth_client, tmdb, interstellar):
    auth_client.get(credits_url(interstellar.id))
    Movie.objects.filter(pk=interstellar.pk).update(
        credits_synced_at=timezone.now() - timedelta(days=365)
    )
    tmdb.get_movie_credits.side_effect = TMDBNotFound("gone")

    response = auth_client.get(credits_url(interstellar.id))

    assert response.status_code == 200
    assert response.json()["directors"][0]["name"] == "Christopher Nolan"


def test_credits_of_nonexistent_movie_returns_404(auth_client, tmdb):
    response = auth_client.get(credits_url(424242))

    assert response.status_code == 404
    tmdb.get_movie_credits.assert_not_called()
