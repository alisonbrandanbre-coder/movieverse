"""Home lists: GET /movies/trending and GET /movies/mood/{slug} (cache, 404, TMDB down)."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.movies.models import TMDBListCache
from apps.movies.moods import MOODS
from apps.movies.services.tmdb_client import TMDBRateLimited, TMDBUnavailable
from tests.factories import make_genre, make_movie

pytestmark = pytest.mark.django_db

TRENDING_URL = "/api/v1/movies/trending"


def mood_url(slug: str) -> str:
    return f"/api/v1/movies/mood/{slug}"


def result(tmdb_id: int, title: str, genre_ids=(35,), backdrop=True, poster=True) -> dict:
    return {
        "id": tmdb_id,
        "title": title,
        "overview": f"Sinopsis de {title}.",
        "release_date": "2024-03-01",
        "poster_path": f"/p{tmdb_id}.jpg" if poster else None,
        "backdrop_path": f"/b{tmdb_id}.jpg" if backdrop else None,
        "vote_count": 3000,
        "vote_average": 7.8,
        "popularity": 120,
        "genre_ids": list(genre_ids),
        "original_language": "en",
    }


TRENDING = {
    "results": [
        result(10, "Dune: Parte dos", (878,)),
        result(11, "Sin póster", poster=False),
        result(12, "Anora", (18,)),
    ]
}


@pytest.mark.parametrize("url", [TRENDING_URL, mood_url("para-reir")])
def test_require_authentication(api_client, url):
    assert api_client.get(url).status_code == 401


# ================================================================ trending


def test_trending_returns_cards_with_backdrop_and_synopsis(auth_client, tmdb):
    tmdb.get_trending_movies.return_value = TRENDING

    body = auth_client.get(TRENDING_URL).json()

    assert body["degraded"] is False
    assert [m["title"] for m in body["results"]] == ["Dune: Parte dos", "Anora"]  # no poster → out
    first = body["results"][0]
    assert set(first) == {
        "id",
        "tmdb_id",
        "title",
        "release_year",
        "poster_url",
        "vote_average",
        "backdrop_url",
        "overview",
    }
    assert first["backdrop_url"].endswith("/w1280/b10.jpg")
    assert first["overview"] == "Sinopsis de Dune: Parte dos."
    tmdb.get_trending_movies.assert_called_once_with("week")


def test_trending_is_cached_and_refreshed_after_six_hours(auth_client, tmdb):
    tmdb.get_trending_movies.return_value = TRENDING

    auth_client.get(TRENDING_URL)
    auth_client.get(TRENDING_URL)
    assert tmdb.get_trending_movies.call_count == 1  # second call from the cache

    TMDBListCache.objects.filter(key="trending:week").update(
        fetched_at=timezone.now() - timedelta(hours=7)
    )
    auth_client.get(TRENDING_URL)
    assert tmdb.get_trending_movies.call_count == 2


def test_trending_with_tmdb_down_uses_the_local_catalog(auth_client, tmdb):
    tmdb.get_trending_movies.side_effect = TMDBUnavailable("down")
    make_movie("Local popular", vote_count=9000, popularity=300)
    make_movie("Poco votada", vote_count=20, popularity=500)

    response = auth_client.get(TRENDING_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert [m["title"] for m in body["results"]] == ["Local popular"]


def test_trending_with_tmdb_down_serves_the_stale_cache(auth_client, tmdb):
    tmdb.get_trending_movies.return_value = TRENDING
    auth_client.get(TRENDING_URL)
    TMDBListCache.objects.update(fetched_at=timezone.now() - timedelta(days=2))
    tmdb.get_trending_movies.side_effect = TMDBRateLimited()

    body = auth_client.get(TRENDING_URL).json()

    assert body["degraded"] is False
    assert [m["title"] for m in body["results"]] == ["Dune: Parte dos", "Anora"]


# ================================================================ moods


def test_mood_uses_its_discover_filters(auth_client, tmdb):
    tmdb.discover_movies.return_value = {"results": [result(20, "Superbad"), result(21, "Barbie")]}

    body = auth_client.get(mood_url("para-reir")).json()

    assert body["mood"] == {
        "slug": "para-reir",
        "label": "Para reír",
        "description": MOODS["para-reir"].description,
    }
    assert [m["title"] for m in body["results"]] == ["Superbad", "Barbie"]
    assert body["degraded"] is False
    params = tmdb.discover_movies.call_args.args[0]
    assert params["with_genres"] == "35"
    assert params["without_genres"] == "27,53"
    assert params["sort_by"] == "popularity.desc"


@pytest.mark.parametrize("slug", list(MOODS))
def test_every_mood_answers(auth_client, tmdb, slug):
    tmdb.discover_movies.return_value = {"results": [result(30, "Una")]}

    response = auth_client.get(mood_url(slug))

    assert response.status_code == 200
    assert response.json()["mood"]["slug"] == slug


def test_six_moods_with_their_labels():
    assert [m.label for m in MOODS.values()] == [
        "Para reír",
        "Para pensar",
        "Adrenalina",
        "Para llorar",
        "Inspiradora",
        "Miedo",
    ]


def test_unknown_mood_is_404(auth_client, tmdb):
    response = auth_client.get(mood_url("aburrido"))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "MOOD_NOT_FOUND"
    tmdb.discover_movies.assert_not_called()


def test_mood_pages_are_cached_separately(auth_client, tmdb):
    tmdb.discover_movies.return_value = {"results": [result(i, f"P{i}") for i in range(40, 60)]}

    first = auth_client.get(mood_url("miedo")).json()
    auth_client.get(mood_url("miedo"))
    second = auth_client.get(mood_url("miedo"), {"page": 2}).json()

    assert first["page"] == 1 and first["has_more"] is True
    assert second["page"] == 2
    assert tmdb.discover_movies.call_count == 2  # page 1 once (cached), page 2 once
    assert auth_client.get(mood_url("miedo"), {"page": 9}).status_code == 400


def test_mood_with_tmdb_down_uses_local_movies_of_its_genres(auth_client, tmdb):
    tmdb.discover_movies.side_effect = TMDBUnavailable("down")
    comedy = make_genre("Comedia", tmdb_id=35)
    horror = make_genre("Terror", tmdb_id=27)
    make_movie("Comedia local", genres=[comedy], vote_count=5000)
    make_movie("Terror local", genres=[horror], vote_count=5000)

    response = auth_client.get(mood_url("para-reir"))

    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert [m["title"] for m in body["results"]] == ["Comedia local"]
