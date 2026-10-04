"""Buscar / Descubrir filters: genres, decade, minimum rating and runtime range.

(Platforms, countries, popularity, sort, "Ocultar las que ya vi" and caching are in
test_catalog_filters.py.)

Without text → TMDB discover with the filters as params; with text → TMDB's search,
filtered by the backend and paginated locally.
"""

from datetime import date

import pytest

from apps.movies.filters import MovieFilters
from apps.movies.models import Genre, Movie
from apps.movies.services.tmdb_client import TMDBUnavailable
from tests.factories import make_genre

from . import tmdb_payloads as payloads

pytestmark = pytest.mark.django_db

SEARCH_URL = "/api/v1/movies/search"
DISCOVER_URL = "/api/v1/movies/discover"


@pytest.fixture
def genres(db) -> dict[str, Genre]:
    return {
        name: make_genre(name, tmdb_id=tmdb_id)
        for name, tmdb_id in [
            ("Aventura", 12),
            ("Drama", 18),
            ("Ciencia ficción", 878),
            ("Acción", 28),
        ]
    }


def result(tmdb_id: int, title: str, *, genres, year: int, rating: float, votes: int = 5000):
    return {
        "id": tmdb_id,
        "title": title,
        "original_title": title,
        "overview": "",
        "release_date": f"{year}-06-01",
        "original_language": "en",
        "poster_path": f"/{tmdb_id}.jpg",
        "backdrop_path": None,
        "popularity": 50.0,
        "vote_average": rating,
        "vote_count": votes,
        "genre_ids": genres,
    }


def page(results, page_number=1, total_pages=1):
    return {
        "page": page_number,
        "total_pages": total_pages,
        "total_results": len(results),
        "results": results,
    }


STAR_SEARCH = [
    result(1, "Star Odyssey", genres=[878, 12], year=1994, rating=7.8),
    result(2, "Star Drama", genres=[18], year=1996, rating=6.1),
    result(3, "Star Wars-ish", genres=[878, 28], year=1977, rating=8.1),
    result(4, "Star Noise", genres=[878], year=1995, rating=9.6, votes=3),  # too few votes
    result(5, "Star Long", genres=[878, 12], year=1998, rating=7.2),
]


# ================================================================ discover (no text)


def test_discover_translates_filters_to_tmdb_params(auth_client, tmdb, genres):
    tmdb.discover_movies.return_value = page([STAR_SEARCH[0]], total_pages=3)

    response = auth_client.get(
        DISCOVER_URL,
        {
            "genres": f"{genres['Ciencia ficción'].pk},{genres['Aventura'].pk}",
            "decade": 1990,
            "rating": 7,
            "runtime": "short",
            "page": 2,
        },
    )

    assert response.status_code == 200
    params = tmdb.discover_movies.call_args.args[0]
    assert tmdb.discover_movies.call_args.kwargs == {"page": 2}
    assert params["with_genres"] == "878,12"  # local ids → TMDB ids, all of them (AND)
    assert params["primary_release_date.gte"] == "1990-01-01"
    assert params["primary_release_date.lte"] == "1999-12-31"
    assert params["vote_average.gte"] == 7
    assert params["with_runtime.lte"] == 89  # "Cortas": less than 90 minutes
    assert params["with_runtime.gte"] == 1
    assert params["sort_by"] == "popularity.desc"
    body = response.json()
    assert body["total_pages"] == 3
    assert body["results"][0]["title"] == "Star Odyssey"
    assert Movie.objects.filter(tmdb_id=1).exists()  # cached like a search result


def test_discover_without_filters_is_popular_and_well_voted(auth_client, tmdb):
    tmdb.discover_movies.return_value = page([])

    assert auth_client.get(DISCOVER_URL).status_code == 200

    params = tmdb.discover_movies.call_args.args[0]
    assert params["sort_by"] == "popularity.desc"
    assert params["vote_count.gte"] >= 50
    assert not {"with_genres", "vote_average.gte", "with_runtime.lte"} & set(params)


@pytest.mark.parametrize(
    ("runtime", "low", "high"),
    [("short", 1, 89), ("normal", 90, 119), ("long", 120, 150), ("epic", 151, None)],
)
def test_runtime_ranges(runtime, low, high):
    params = MovieFilters(runtime=runtime).discover_params()

    assert params["with_runtime.gte"] == low
    assert params.get("with_runtime.lte") == high


@pytest.mark.parametrize(
    "params",
    [
        {"genres": "abc"},
        {"genres": "999999"},  # unknown genre
        {"decade": 1995},
        {"decade": 1900},
        {"rating": 9},
        {"runtime": 100},
        {"runtime": 90},  # the old "less than" values are gone
        {"page": 0},
    ],
)
def test_invalid_filters_are_a_400(auth_client, tmdb, genres, params):
    response = auth_client.get(DISCOVER_URL, params)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    tmdb.discover_movies.assert_not_called()


def test_discover_requires_authentication(api_client):
    assert api_client.get(DISCOVER_URL).status_code == 401


# ================================================================ search with filters


def titles(response) -> list[str]:
    return [movie["title"] for movie in response.json()["results"]]


def test_search_without_filters_is_unchanged(auth_client, tmdb):
    auth_client.get(SEARCH_URL, {"q": "interstellar"})

    tmdb.search_movies.assert_called_once_with("interstellar", page=1)


def test_search_filters_by_genres_decade_and_rating(auth_client, tmdb, genres):
    tmdb.search_movies.return_value = page(STAR_SEARCH)
    scifi = genres["Ciencia ficción"].pk

    by_genre = auth_client.get(SEARCH_URL, {"q": "star", "genres": scifi})
    by_two_genres = auth_client.get(
        SEARCH_URL, {"q": "star", "genres": f"{scifi},{genres['Aventura'].pk}"}
    )
    by_decade = auth_client.get(SEARCH_URL, {"q": "star", "decade": 1990})
    by_rating = auth_client.get(SEARCH_URL, {"q": "star", "rating": 7})

    assert titles(by_genre) == ["Star Odyssey", "Star Wars-ish", "Star Noise", "Star Long"]
    assert titles(by_two_genres) == ["Star Odyssey", "Star Long"]
    assert titles(by_decade) == ["Star Odyssey", "Star Drama", "Star Noise", "Star Long"]
    # "Star Noise" has 9.6 but only 3 votes: not a real rating.
    assert titles(by_rating) == ["Star Odyssey", "Star Wars-ish", "Star Long"]
    assert by_rating.json()["total_results"] == 3
    assert by_rating.json()["total_pages"] == 1


def test_search_runtime_filter_fetches_details_only_when_needed(auth_client, tmdb, genres):
    tmdb.search_movies.return_value = page(STAR_SEARCH)
    runtimes = {1: 135, 5: 151, 3: 119}

    def details(tmdb_id):
        movie = next(r for r in STAR_SEARCH if r["id"] == tmdb_id)
        return {
            **{k: v for k, v in movie.items() if k != "genre_ids"},
            "runtime": runtimes[tmdb_id],
            "genres": [{"id": g, "name": str(g)} for g in movie["genre_ids"]],
        }

    tmdb.get_movie_details.side_effect = details

    response = auth_client.get(
        SEARCH_URL,
        {"q": "star", "genres": genres["Ciencia ficción"].pk, "rating": 7, "runtime": "long"},
    )

    assert titles(response) == ["Star Odyssey"]
    # Only the 3 movies that passed genre + rating needed their runtime.
    fetched = sorted(call.args[0] for call in tmdb.get_movie_details.call_args_list)
    assert fetched == [1, 3, 5]
    assert Movie.objects.get(tmdb_id=1).runtime == 135  # cached for next time


def test_unknown_runtime_does_not_pass_a_runtime_filter(auth_client, tmdb, genres):
    tmdb.search_movies.return_value = page([STAR_SEARCH[0]])
    tmdb.get_movie_details.side_effect = TMDBUnavailable("down")

    response = auth_client.get(SEARCH_URL, {"q": "star", "runtime": "short"})

    assert response.status_code == 200
    assert titles(response) == []


def test_filtered_search_scans_several_tmdb_pages_and_paginates_locally(auth_client, tmdb, genres):
    def search(query, page):
        results = [
            result(100 * page + i, f"Star {page}-{i:02d}", genres=[878], year=1990, rating=7.5)
            for i in range(20)
        ]
        return {"page": page, "total_pages": 9, "total_results": 180, "results": results}

    tmdb.search_movies.side_effect = search

    first = auth_client.get(SEARCH_URL, {"q": "star", "decade": 1990})
    third = auth_client.get(SEARCH_URL, {"q": "star", "decade": 1990, "page": 3})

    pages_asked = sorted({call.kwargs["page"] for call in tmdb.search_movies.call_args_list})
    assert pages_asked == [1, 2, 3]  # bounded scan, not the 9 pages
    assert first.json()["total_results"] == 60
    assert first.json()["total_pages"] == 3
    assert len(first.json()["results"]) == 20
    assert titles(third)[0] == "Star 3-00"


def test_search_filters_use_the_local_genres_of_known_movies(auth_client, tmdb, genres):
    """A movie already cached with full details keeps its (complete) genre list."""
    auth_client.get(SEARCH_URL, {"q": "interstellar"})
    movie = Movie.objects.get(tmdb_id=payloads.INTERSTELLAR_ID)
    movie.genres.set([genres["Drama"]])
    movie.release_date = date(2014, 11, 5)
    movie.save()

    response = auth_client.get(SEARCH_URL, {"q": "interstellar", "genres": genres["Drama"].pk})

    assert titles(response) == ["Interstellar"]
