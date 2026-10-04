"""SAGA (TMDB collections) and UNIVERSE (shared universes, apps/graph/universes.py)."""

from unittest.mock import MagicMock

import pytest
from django.utils import timezone

from apps.graph import services as graph
from apps.graph.universes import UNIVERSES, universes_of
from apps.movies.models import Movie, MoviePerson, Person
from apps.movies.services import movie_service
from apps.movies.services.normalizers import normalize_movie_details
from apps.movies.services.tmdb_client import TMDBClient
from tests.factories import make_genre, make_movie

pytestmark = pytest.mark.django_db

HARRY_POTTER, FANTASTIC_BEASTS, IRON_MAN_SAGA = 1241, 435259, 131292
MCU_KEYWORD = 180547
NEWELL = 10723


def url(movie_id, suffix="") -> str:
    return f"/api/v1/graph/movies/{movie_id}{suffix}"


def summary(tmdb_id, title, year, genre_ids=(14, 12), votes=15000):
    return {
        "id": tmdb_id,
        "title": title,
        "release_date": f"{year}-06-01" if year else "",
        "poster_path": f"/{tmdb_id}.jpg",
        "vote_count": votes,
        "vote_average": 7.6,
        "popularity": 50,
        "genre_ids": list(genre_ids),
        "original_language": "en",
    }


HP_PARTS = [
    summary(671, "Harry Potter y la piedra filosofal", 2001),
    summary(672, "Harry Potter y la cámara secreta", 2002),
    summary(673, "Harry Potter y el prisionero de Azkaban", 2004),
    summary(674, "Harry Potter y el cáliz de fuego", 2005),
    summary(675, "Harry Potter y la Orden del Fénix", 2007),
    summary(767, "Harry Potter y el misterio del príncipe", 2009),
    summary(12444, "Harry Potter y las Reliquias de la Muerte - Parte 1", 2010),
    summary(12445, "Harry Potter y las Reliquias de la Muerte - Parte 2", 2011),
    summary(99999, "Harry Potter (anunciada)", None),
]
BEASTS_PARTS = [
    summary(259316, "Animales fantásticos y dónde encontrarlos", 2016),
    summary(338952, "Animales fantásticos: Los crímenes de Grindelwald", 2018),
    summary(338953, "Animales fantásticos: Los secretos de Dumbledore", 2022),
]
IRON_MAN_PARTS = [
    summary(1726, "Iron Man", 2008, (28, 878)),
    summary(10138, "Iron Man 2", 2010, (28, 878)),
    summary(68721, "Iron Man 3", 2013, (28, 878)),
]
MCU_MOVIES = [
    summary(24428, "Los Vengadores", 2012, (28, 878), votes=31000),
    summary(1771, "Capitán América: El primer vengador", 2011, (28, 878), votes=40000),
    summary(1726, "Iron Man", 2008, (28, 878)),
    summary(10138, "Iron Man 2", 2010, (28, 878)),
    summary(299536, "Vengadores: Infinity War", 2018, (28, 878), votes=30000),
    summary(284052, "Doctor Strange", 2016, (28, 878)),
    summary(284054, "Pantera Negra", 2018, (28, 878)),
]
COLLECTIONS = {
    HARRY_POTTER: {"name": "Harry Potter - Colección", "parts": HP_PARTS},
    FANTASTIC_BEASTS: {"name": "Animales fantásticos - Colección", "parts": BEASTS_PARTS},
    IRON_MAN_SAGA: {"name": "Iron Man - Colección", "parts": IRON_MAN_PARTS},
}


@pytest.fixture
def genres():
    return {
        "fantasy": make_genre("Fantasía", tmdb_id=14),
        "adventure": make_genre("Aventura", tmdb_id=12),
        "action": make_genre("Acción", tmdb_id=28),
        "scifi": make_genre("Ciencia ficción", tmdb_id=878),
    }


@pytest.fixture
def tmdb(monkeypatch) -> MagicMock:
    mock = MagicMock(spec=TMDBClient)
    mock.get_genres.return_value = []
    mock.get_movie_recommendations.return_value = {"results": []}
    mock.get_similar_movies.return_value = {"results": []}
    mock.get_person_movie_credits.return_value = {"cast": [], "crew": []}
    mock.get_collection.side_effect = lambda collection_id: COLLECTIONS[collection_id]
    mock.discover_movies.side_effect = lambda params, page=1: (
        {"results": MCU_MOVIES}
        if params.get("with_keywords") == str(MCU_KEYWORD)
        else {"results": []}
    )
    monkeypatch.setattr(movie_service, "TMDBClient", lambda: mock)
    return mock


def center(title, tmdb_id, genres, *, collection=None, keywords=(), year="2005-11-18"):
    """A center whose details (saga, keywords) and credits are already cached."""
    now = timezone.now()
    return make_movie(
        title,
        tmdb_id=tmdb_id,
        genres=genres,
        vote_count=20000,
        release_date=year,
        collection_tmdb_id=collection,
        collection_name=COLLECTIONS[collection]["name"] if collection else "",
        keyword_ids=list(keywords),
        metadata_synced_at=now,
        credits_synced_at=now,
    )


@pytest.fixture
def goblet(genres):
    return center(
        "Harry Potter y el cáliz de fuego",
        674,
        [genres["fantasy"], genres["adventure"]],
        collection=HARRY_POTTER,
    )


@pytest.fixture
def iron_man(genres):
    return center(
        "Iron Man",
        1726,
        [genres["action"], genres["scifi"]],
        collection=IRON_MAN_SAGA,
        keywords=[MCU_KEYWORD, 4565],
        year="2008-04-30",
    )


def edges_by_title(body) -> dict[str, dict]:
    titles = {n["id"]: n["title"] for n in body["nodes"]}
    return {titles[e["target"]]: e for e in body["edges"]}


def of_type(body, kind) -> list[dict]:
    return [e for e in body["edges"] if e["type"] == kind]


# ================================================================ SAGA


def test_movies_of_the_same_collection_connect_as_saga(auth_client, goblet, tmdb):
    body = auth_client.get(url(goblet.pk)).json()

    sagas = of_type(body, "SAGA")
    assert sagas
    reason = sagas[0]["reasons"][0]
    assert reason == {
        "type": "SAGA",
        "label": "De la saga Harry Potter",
        "short": "Saga Harry Potter",
    }
    titles = {n["id"]: n["title"] for n in body["nodes"]}
    assert all(titles[e["target"]].startswith("Harry Potter") for e in sagas)


def test_at_most_three_movies_of_the_saga_and_the_rest_is_offered(auth_client, goblet, tmdb):
    body = auth_client.get(url(goblet.pk)).json()

    assert len(of_type(body, "SAGA")) == 3
    # 8 released movies (the announced one does not count), the center included.
    assert body["saga"] == {"name": "Harry Potter", "total": 8}


def test_saga_is_stronger_than_director_and_wins_on_the_same_edge(auth_client, goblet, tmdb):
    newell = Person.objects.create(tmdb_id=NEWELL, name="Mike Newell")
    MoviePerson.objects.create(movie=goblet, person=newell, role_type="DIRECTOR")
    # Newell "directed" a saga movie too (made up) and a movie outside the saga.
    tmdb.get_person_movie_credits.side_effect = lambda person_id: {
        "cast": [],
        "crew": [
            {**summary(675, "Harry Potter y la Orden del Fénix", 2007), "job": "Director"},
            {**summary(1700, "Donnie Brasco", 1997, (80, 18)), "job": "Director"},
        ],
    }

    edges = edges_by_title(auth_client.get(url(goblet.pk)).json())

    both = edges["Harry Potter y la Orden del Fénix"]
    assert both["type"] == "SAGA"  # the saga wins even if they also share the director
    assert both["types"] == ["SAGA", "DIRECTOR", "GENRE"]
    assert both["reasons"][1]["short"] == "Mike Newell"
    assert both["strength"] == 1.0
    assert edges["Donnie Brasco"]["type"] == "DIRECTOR"
    assert both["strength"] > edges["Donnie Brasco"]["strength"]
    assert graph.STRENGTH["SAGA"] > graph.STRENGTH["UNIVERSE"] > graph.STRENGTH["DIRECTOR"]


def test_the_saga_is_cached_on_its_movies(auth_client, goblet, tmdb):
    auth_client.get(url(goblet.pk))

    stone = Movie.objects.get(tmdb_id=671)
    assert stone.collection_tmdb_id == HARRY_POTTER
    assert stone.collection_name == "Harry Potter - Colección"


def test_full_saga_endpoint_lists_every_released_movie_in_order(auth_client, goblet, tmdb):
    body = auth_client.get(url(goblet.pk, "/saga")).json()

    titles = {n["id"]: n["title"] for n in body["nodes"]}
    order = [titles[e["target"]] for e in body["edges"]]
    assert len(order) == 7  # the other 7 released movies
    assert order[0] == "Harry Potter y la piedra filosofal"
    assert order[-1] == "Harry Potter y las Reliquias de la Muerte - Parte 2"
    assert {e["type"] for e in body["edges"]} == {"SAGA"}
    assert body["saga"] == {"name": "Harry Potter", "total": 8}


def test_full_saga_endpoint_404_without_saga(auth_client, genres, tmdb):
    movie = center("Interstellar", 157336, [genres["scifi"]])

    response = auth_client.get(url(movie.pk, "/saga"))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SAGA_NOT_FOUND"


# ================================================================ UNIVERSE


def test_iron_man_connects_with_captain_america_as_universe(auth_client, iron_man, tmdb):
    edges = edges_by_title(auth_client.get(url(iron_man.pk)).json())

    captain = edges["Capitán América: El primer vengador"]
    assert captain["type"] == "UNIVERSE"
    assert captain["reasons"][0] == {
        "type": "UNIVERSE",
        "label": "Del Universo Marvel",
        "short": "Universo Marvel",
    }
    # Same saga *and* same universe: the saga wins and the universe is not repeated.
    assert edges["Iron Man 2"]["type"] == "SAGA"
    assert "UNIVERSE" not in edges["Iron Man 2"]["types"]


def test_harry_potter_connects_with_fantastic_beasts_as_universe(auth_client, goblet, tmdb):
    edges = edges_by_title(auth_client.get(url(goblet.pk)).json())

    beasts = [e for title, e in edges.items() if title.startswith("Animales fantásticos")]
    assert beasts
    assert {e["type"] for e in beasts} == {"UNIVERSE"}
    assert beasts[0]["reasons"][0]["short"] == "Wizarding World"


def test_saga_and_universe_together_take_at_most_four(auth_client, goblet, tmdb):
    body = auth_client.get(url(goblet.pk)).json()

    franchise = [e for e in body["edges"] if e["type"] in ("SAGA", "UNIVERSE")]
    assert len(franchise) == 4
    assert len(of_type(body, "SAGA")) == 3


def test_interstellar_has_no_saga_nor_universe(auth_client, genres, tmdb):
    interstellar = center("Interstellar", 157336, [genres["scifi"]], keywords=[3801, 9882])
    make_movie("Gravity", genres=[genres["scifi"]], vote_count=15000, release_date="2013-10-04")

    body = auth_client.get(url(interstellar.pk)).json()

    assert universes_of(interstellar) == []
    assert body["saga"] is None
    assert not [e for e in body["edges"] if {"SAGA", "UNIVERSE"} & set(e["types"])]
    tmdb.get_collection.assert_not_called()
    tmdb.discover_movies.assert_not_called()


def test_select_caps_are_never_relaxed():
    saga = [
        graph.Connection(make_movie(f"Parte {i}", release_date="2001-01-01"), saga="X")
        for i in range(6)
    ]

    picked = graph.select(saga, limit=12)

    assert len(picked) == graph.MAX_PER_SAGA  # even if that leaves fewer than 8 edges


# ================================================================ cache / config


def test_details_store_saga_and_keywords():
    fields = normalize_movie_details(
        {
            "title": "Iron Man",
            "belongs_to_collection": {"id": IRON_MAN_SAGA, "name": "Iron Man - Colección"},
            "keywords": {"keywords": [{"id": 4565, "name": "dystopia"}, {"id": MCU_KEYWORD}]},
        }
    )

    assert fields["collection_tmdb_id"] == IRON_MAN_SAGA
    assert fields["collection_name"] == "Iron Man - Colección"
    assert fields["keyword_ids"] == [4565, MCU_KEYWORD]
    assert normalize_movie_details({"title": "Sin saga"})["collection_tmdb_id"] is None


@pytest.mark.parametrize(
    ("raw", "clean"),
    [
        ("Harry Potter - Colección", "Harry Potter"),
        ("Iron Man Collection", "Iron Man"),
        ("El Señor de los Anillos: Colección", "El Señor de los Anillos"),
        ("Colección Toy Story", "Toy Story"),
    ],
)
def test_saga_names_are_cleaned(raw, clean):
    assert graph.saga_name(raw) == clean


def test_universe_config_is_unique_and_complete():
    keys = [u.key for u in UNIVERSES]
    assert len(keys) == len(set(keys))
    assert all(u.name and (u.keywords or u.collections) for u in UNIVERSES)
    assert {u.name for u in UNIVERSES} >= {
        "Universo Marvel",
        "Universo DC",
        "Wizarding World",
        "MonsterVerse",
        "Universo de El Conjuro",
    }
