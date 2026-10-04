from datetime import date
from unittest.mock import MagicMock

import pytest
from django.utils import timezone

from apps.graph import services as graph
from apps.movies.models import MoviePerson, Person
from apps.movies.services import movie_service
from apps.movies.services.tmdb_client import TMDBClient, TMDBUnavailable
from tests.factories import make_genre, make_movie

pytestmark = pytest.mark.django_db

NOLAN, MCCONAUGHEY, HATHAWAY, CAINE, CHASTAIN, DAMON, EXTRA = (
    525,
    10297,
    1813,
    3895,
    83002,
    1892,
    999,
)


def url(movie_id, **params) -> str:
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"/api/v1/graph/movies/{movie_id}" + (f"?{query}" if query else "")


def summary(tmdb_id, title, genre_ids=(878,), votes=5000, year=2010, order=None, job=None):
    item = {
        "id": tmdb_id,
        "title": title,
        "release_date": f"{year}-01-01" if year else "",
        "poster_path": f"/{tmdb_id}.jpg",
        "vote_count": votes,
        "vote_average": 7.5,
        "popularity": 10,
        "genre_ids": list(genre_ids),
        "original_language": "en",
    }
    if order is not None:
        item["order"] = order
    if job is not None:
        item["job"] = job
    return item


@pytest.fixture
def genres():
    return {
        "scifi": make_genre("Ciencia ficción", tmdb_id=878),
        "drama": make_genre("Drama", tmdb_id=18),
        "adventure": make_genre("Aventura", tmdb_id=12),
        "comedy": make_genre("Comedia", tmdb_id=35),
        "tv": make_genre("Película de TV", tmdb_id=10770),
    }


@pytest.fixture
def interstellar(genres):
    """Center with metadata and credits already cached (no TMDB call needed for them)."""
    now = timezone.now()
    movie = make_movie(
        "Interstellar",
        tmdb_id=157336,
        genres=[genres["scifi"], genres["drama"], genres["adventure"]],
        vote_count=36000,
        vote_average=8.4,
        release_date="2014-11-05",
        metadata_synced_at=now,
        credits_synced_at=now,
    )
    people = {
        tmdb_id: Person.objects.create(tmdb_id=tmdb_id, name=name)
        for tmdb_id, name in [
            (NOLAN, "Christopher Nolan"),
            (MCCONAUGHEY, "Matthew McConaughey"),
            (HATHAWAY, "Anne Hathaway"),
            (CHASTAIN, "Jessica Chastain"),
            (CAINE, "Michael Caine"),
            (DAMON, "Matt Damon"),
            (EXTRA, "Actor de reparto"),
        ]
    }
    MoviePerson.objects.create(movie=movie, person=people[NOLAN], role_type="DIRECTOR")
    for order, tmdb_id in enumerate([MCCONAUGHEY, HATHAWAY, CHASTAIN, CAINE, DAMON, EXTRA]):
        MoviePerson.objects.create(
            movie=movie, person=people[tmdb_id], role_type="ACTOR", credit_order=order
        )
    return movie


FILMOGRAPHIES = {
    NOLAN: {
        "crew": [
            summary(27205, "Inception", (878, 28, 12), year=2010, job="Director"),
            summary(77, "Memento", (9648, 53), year=2000, job="Director"),
            summary(155, "The Dark Knight", (18, 28), year=2008, job="Director"),
            summary(157336, "Interstellar", (878, 18, 12), year=2014, job="Director"),
            summary(1, "Producida por Nolan", (878,), job="Producer"),
            summary(2, "Próxima de Nolan", (878,), year=None, job="Director"),
        ],
        "cast": [],
    },
    MCCONAUGHEY: {
        "cast": [
            summary(152532, "Dallas Buyers Club", (18,), year=2013, order=0),
            summary(3, "Cameo de McConaughey", (18,), year=2012, order=12),
        ],
        "crew": [],
    },
    HATHAWAY: {"cast": [summary(155, "The Dark Knight", (18, 28), year=2008, order=4)], "crew": []},
    CHASTAIN: {"cast": [], "crew": []},
    CAINE: {"cast": [summary(155, "The Dark Knight", (18, 28), year=2008, order=3)], "crew": []},
    DAMON: {
        "cast": [summary(286217, "The Martian", (878, 18, 12), year=2015, order=0)],
        "crew": [],
    },
    EXTRA: {"cast": [summary(4, "Protagónico del 6.º actor", (878,), order=0)], "crew": []},
}


@pytest.fixture
def tmdb(monkeypatch) -> MagicMock:
    mock = MagicMock(spec=TMDBClient)
    mock.get_genres.return_value = []
    mock.get_person_movie_credits.side_effect = lambda person_id: FILMOGRAPHIES[person_id]
    mock.get_movie_recommendations.return_value = {
        "results": [summary(286217, "The Martian", (878, 18, 12), year=2015)]
    }
    mock.get_similar_movies.return_value = {
        "results": [summary(49047, "Gravity", (878, 53), year=2013)]
    }
    monkeypatch.setattr(movie_service, "TMDBClient", lambda: mock)
    return mock


def edges_by_title(body) -> dict[str, dict]:
    titles = {n["id"]: n["title"] for n in body["nodes"]}
    return {titles[e["target"]]: e for e in body["edges"]}


# ================================================================ contract


def test_requires_authentication(api_client, interstellar):
    response = api_client.get(url(interstellar.pk))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_response_format(auth_client, interstellar, tmdb):
    response = auth_client.get(url(interstellar.pk))

    assert response.status_code == 200
    body = response.json()
    assert body["center"] == interstellar.pk
    assert body["degraded"] is False
    center = body["nodes"][0]
    assert center == {
        "id": interstellar.pk,
        "tmdb_id": 157336,
        "title": "Interstellar",
        "poster": "https://image.tmdb.org/t/p/w500/interstellar.jpg",
        "year": 2014,
        "score": 8.4,
        "overview": "",
    }
    for edge in body["edges"]:
        assert set(edge) == {"source", "target", "type", "types", "label", "reasons", "strength"}


def test_every_edge_has_type_label_and_strength(auth_client, interstellar, tmdb):
    body = auth_client.get(url(interstellar.pk)).json()
    node_ids = {n["id"] for n in body["nodes"]}

    assert body["edges"]
    for edge in body["edges"]:
        assert edge["source"] == interstellar.pk
        assert edge["target"] in node_ids
        assert edge["type"] in {"DIRECTOR", "ACTOR", "SIMILAR", "GENRE"}
        assert edge["type"] == edge["types"][0]
        assert edge["label"].strip()
        assert all(r["type"] and r["label"] for r in edge["reasons"])
        assert 0 < edge["strength"] <= 1


def test_no_duplicated_nodes_and_types_are_combined(auth_client, interstellar, tmdb):
    body = auth_client.get(url(interstellar.pk)).json()
    ids = [n["id"] for n in body["nodes"]]

    assert len(ids) == len(set(ids))
    assert interstellar.pk not in [e["target"] for e in body["edges"]]  # never its own neighbor
    # The Dark Knight: Nolan + Hathaway + Caine + Drama → one edge with every reason.
    dark_knight = edges_by_title(body)["The Dark Knight"]
    assert dark_knight["types"] == ["DIRECTOR", "ACTOR", "GENRE"]
    assert dark_knight["label"] == (
        "Dirigidas por Christopher Nolan · Ambas con Anne Hathaway y Michael Caine"
        " · Comparten Drama"
    )
    assert sum(1 for e in body["edges"] if e["target"] == dark_knight["target"]) == 1


@pytest.mark.parametrize("limit", [1, 3, 5])
def test_respects_the_limit(auth_client, interstellar, tmdb, limit):
    body = auth_client.get(url(interstellar.pk, limit=limit)).json()

    assert len(body["edges"]) == limit
    assert len(body["nodes"]) == limit + 1


@pytest.mark.parametrize("limit", [0, 13, "abc"])
def test_rejects_invalid_limits(auth_client, interstellar, tmdb, limit):
    response = auth_client.get(url(interstellar.pk, limit=limit))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("movie_id", [999_999, 0])
def test_unknown_movie_returns_404(auth_client, tmdb, movie_id):
    response = auth_client.get(url(movie_id))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "MOVIE_NOT_FOUND"


def test_non_numeric_id_returns_404(auth_client):
    assert auth_client.get("/api/v1/graph/movies/abc").status_code == 404


# ================================================================ connections


def test_readable_and_verifiable_labels(auth_client, interstellar, tmdb):
    edges = edges_by_title(auth_client.get(url(interstellar.pk)).json())

    assert edges["Inception"]["reasons"][0] == {
        "type": "DIRECTOR",
        "label": "Dirigidas por Christopher Nolan",
    }
    assert edges["Dallas Buyers Club"]["reasons"][0] == {
        "type": "ACTOR",
        "label": "Ambas con Matthew McConaughey",
    }
    assert edges["Gravity"]["reasons"][0] == {"type": "SIMILAR", "label": "Similares según TMDB"}
    assert {"type": "GENRE", "label": "Comparten Aventura, Ciencia ficción y Drama"} in edges[
        "The Martian"
    ]["reasons"]


def test_strengths_by_type(auth_client, interstellar, tmdb, genres):
    make_movie(
        "Solo dos géneros",
        genres=[genres["scifi"], genres["drama"]],
        vote_count=9000,
        release_date="2001-01-01",
    )
    make_movie(
        "Solo un género",
        genres=[genres["scifi"], genres["comedy"]],
        vote_count=8000,
        release_date="2002-01-01",
    )

    edges = edges_by_title(auth_client.get(url(interstellar.pk)).json())

    assert edges["Memento"]["strength"] == 1.0  # director only
    assert edges["Dallas Buyers Club"]["strength"] == pytest.approx(0.95)  # actor + 1 genre
    assert edges["Gravity"]["strength"] == pytest.approx(0.85)  # similar + 1 genre
    assert edges["Solo dos géneros"]["strength"] == 0.6
    assert edges["Solo un género"]["strength"] == 0.35


def test_director_connection_weighs_more_than_genre(auth_client, interstellar, tmdb, genres):
    make_movie(
        "Mismos tres géneros",
        genres=[genres["scifi"], genres["drama"], genres["adventure"]],
        vote_count=30000,
        vote_average=9.0,
        release_date="2005-01-01",
    )

    body = auth_client.get(url(interstellar.pk)).json()
    edges = edges_by_title(body)

    assert edges["Memento"]["strength"] > edges["Mismos tres géneros"]["strength"]
    order = [e["target"] for e in body["edges"]]
    assert order.index(edges["Memento"]["target"]) < order.index(
        edges["Mismos tres géneros"]["target"]
    )


def test_only_lead_actors_count(auth_client, interstellar, tmdb):
    titles = set(edges_by_title(auth_client.get(url(interstellar.pk)).json()))

    assert "Cameo de McConaughey" not in titles  # 13th in that movie's billing
    assert "Protagónico del 6.º actor" not in titles  # 6th in Interstellar's billing
    tmdb.get_person_movie_credits.assert_any_call(MCCONAUGHEY)
    assert EXTRA not in [c.args[0] for c in tmdb.get_person_movie_credits.call_args_list]


def test_excludes_unreleased_and_non_directing_credits(auth_client, interstellar, tmdb):
    titles = set(edges_by_title(auth_client.get(url(interstellar.pk)).json()))

    assert "Producida por Nolan" not in titles
    assert "Próxima de Nolan" not in titles


def test_tv_movies_are_skipped(auth_client, interstellar, tmdb, genres):
    make_movie(
        "Especial de TV",
        genres=[genres["scifi"], genres["tv"]],
        vote_count=5000,
        release_date="2010-01-01",
    )

    titles = set(edges_by_title(auth_client.get(url(interstellar.pk)).json()))

    assert "Especial de TV" not in titles


# ================================================================ diversity


def test_diversity_not_everything_by_genre(auth_client, interstellar, tmdb, genres):
    for i in range(20):  # many well-known titles sharing 2+ genres
        make_movie(
            f"Género {i}",
            genres=[genres["scifi"], genres["drama"]],
            vote_count=20000 + i,
            release_date="2010-01-01",
        )

    edges = auth_client.get(url(interstellar.pk)).json()["edges"]

    assert 8 <= len(edges) <= 12
    assert sum(e["type"] == "GENRE" for e in edges) <= 4  # a third of 12
    assert {"DIRECTOR", "ACTOR", "SIMILAR"} <= {e["type"] for e in edges}


def test_one_person_does_not_take_the_whole_map(auth_client, interstellar, tmdb, genres):
    for i in range(10):  # other options exist, so the per-person cap holds
        make_movie(
            f"Otra {i}",
            genres=[genres["scifi"], genres["drama"]],
            vote_count=5000 + i,
            release_date="2011-01-01",
        )
    FILMOGRAPHIES[NOLAN]["crew"] += [
        summary(10_000 + i, f"Nolan {i}", (99,), year=2001 + i, job="Director") for i in range(10)
    ]
    try:
        edges = auth_client.get(url(interstellar.pk)).json()["edges"]
    finally:
        FILMOGRAPHIES[NOLAN]["crew"] = FILMOGRAPHIES[NOLAN]["crew"][:6]

    assert sum(e["type"] == "DIRECTOR" for e in edges) == graph.MAX_PER_PERSON


def test_select_relaxes_caps_to_fill_the_list():
    from types import SimpleNamespace

    def connection(i):
        c = graph.Connection(movie=SimpleNamespace(pk=i), shared_genres=["Drama", "Comedia"])
        return c

    picked = graph.select([connection(i) for i in range(10)], 6)

    assert len(picked) == 6  # only genre connections exist: the genre cap is relaxed


# ================================================================ cache and TMDB failures


def test_expanding_again_uses_the_cache(auth_client, interstellar, tmdb):
    auth_client.get(url(interstellar.pk))
    calls = tmdb.get_person_movie_credits.call_count + tmdb.get_similar_movies.call_count

    auth_client.get(url(interstellar.pk))

    assert calls > 0
    assert tmdb.get_person_movie_credits.call_count + tmdb.get_similar_movies.call_count == calls


def test_tmdb_down_does_not_break_the_api(auth_client, interstellar, tmdb, genres):
    for method in ("get_person_movie_credits", "get_movie_recommendations", "get_similar_movies"):
        getattr(tmdb, method).side_effect = TMDBUnavailable("down")
    make_movie(
        "Local",
        genres=[genres["scifi"], genres["drama"]],
        vote_count=9000,
        release_date="2001-01-01",
    )

    response = auth_client.get(url(interstellar.pk))

    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert [n["title"] for n in body["nodes"]] == ["Interstellar", "Local"]


def test_tmdb_down_without_credits_cache(auth_client, genres, tmdb):
    """Center never synced and TMDB down: the stored row is still the center."""
    center = make_movie("Sin sincronizar", genres=[genres["scifi"]], release_date="2000-01-01")
    tmdb.get_movie_details.side_effect = TMDBUnavailable("down")
    tmdb.get_movie_credits.side_effect = TMDBUnavailable("down")
    tmdb.get_movie_recommendations.side_effect = TMDBUnavailable("down")
    tmdb.get_similar_movies.side_effect = TMDBUnavailable("down")

    response = auth_client.get(url(center.pk))

    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert body["nodes"][0]["title"] == "Sin sincronizar"
    assert body["edges"] == []


def test_local_credits_also_connect(auth_client, interstellar, tmdb, genres):
    """A movie whose credits were cached locally connects even if TMDB lists miss it."""
    other = make_movie(
        "Following", genres=[genres["comedy"]], vote_count=900, release_date=date(1998, 9, 12)
    )
    MoviePerson.objects.create(
        movie=other, person=Person.objects.get(tmdb_id=NOLAN), role_type="DIRECTOR"
    )

    edges = edges_by_title(auth_client.get(url(interstellar.pk)).json())

    assert edges["Following"]["reasons"] == [
        {"type": "DIRECTOR", "label": "Dirigidas por Christopher Nolan"}
    ]
