from unittest.mock import MagicMock

import pytest
import requests

from apps.movies.services.tmdb_client import (
    TMDBAuthError,
    TMDBClient,
    TMDBNotConfigured,
    TMDBNotFound,
    TMDBRateLimited,
    TMDBUnavailable,
)


def make_response(status=200, json_data=None, headers=None, invalid_json=False):
    response = MagicMock(spec=requests.Response)
    response.status_code = status
    response.headers = headers or {}
    if invalid_json:
        response.json.side_effect = ValueError("no json")
    else:
        response.json.return_value = json_data if json_data is not None else {}
    return response


def make_client(response=None, side_effect=None, api_key="v3-key"):
    session = MagicMock(spec=requests.Session)
    session.get.return_value = response
    session.get.side_effect = side_effect
    client = TMDBClient(
        api_key=api_key,
        base_url="https://tmdb.test/3",
        language="es-ES",
        timeout=3,
        session=session,
    )
    return client, session


def test_search_sends_query_language_and_v3_key():
    client, session = make_client(make_response(json_data={"results": []}))

    assert client.search_movies("interstellar", page=2) == {"results": []}

    url = session.get.call_args.args[0]
    kwargs = session.get.call_args.kwargs
    assert url == "https://tmdb.test/3/search/movie"
    assert kwargs["params"] == {
        "language": "es-ES",
        "query": "interstellar",
        "page": 2,
        "include_adult": "false",
        "api_key": "v3-key",
    }
    assert kwargs["timeout"] == 3
    assert "Authorization" not in kwargs["headers"]


def test_v4_read_token_is_sent_as_bearer_header():
    client, session = make_client(make_response(json_data={}), api_key="eyJhbGciOi.token")

    client.get_movie_details(157336)

    kwargs = session.get.call_args.kwargs
    assert kwargs["headers"]["Authorization"] == "Bearer eyJhbGciOi.token"
    assert "api_key" not in kwargs["params"]


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get_movie_details", "/movie/157336"),
        ("get_movie_credits", "/movie/157336/credits"),
        ("get_similar_movies", "/movie/157336/similar"),
    ],
)
def test_movie_endpoints_paths(method, path):
    client, session = make_client(make_response(json_data={"id": 157336}))

    getattr(client, method)(157336)

    assert session.get.call_args.args[0] == f"https://tmdb.test/3{path}"


def test_get_genres_returns_list():
    client, _ = make_client(make_response(json_data={"genres": [{"id": 1, "name": "X"}]}))

    assert client.get_genres() == [{"id": 1, "name": "X"}]


def test_missing_api_key_raises_not_configured():
    client, session = make_client(api_key="")

    with pytest.raises(TMDBNotConfigured):
        client.search_movies("x")
    session.get.assert_not_called()


@pytest.mark.parametrize(
    ("side_effect", "expected"),
    [
        (requests.Timeout("slow"), TMDBUnavailable),
        (requests.ConnectionError("down"), TMDBUnavailable),
    ],
)
def test_transport_errors_are_translated(side_effect, expected):
    client, _ = make_client(side_effect=side_effect)

    with pytest.raises(expected):
        client.search_movies("x")


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        (401, TMDBAuthError),
        (404, TMDBNotFound),
        (429, TMDBRateLimited),
        (500, TMDBUnavailable),
        (503, TMDBUnavailable),
    ],
)
def test_http_errors_are_translated(status, expected):
    client, _ = make_client(make_response(status=status))

    with pytest.raises(expected):
        client.get_movie_details(1)


def test_rate_limit_exposes_retry_after():
    client, _ = make_client(make_response(status=429, headers={"Retry-After": "7"}))

    with pytest.raises(TMDBRateLimited) as excinfo:
        client.search_movies("x")
    assert excinfo.value.retry_after == 7


def test_invalid_json_is_unavailable():
    client, _ = make_client(make_response(invalid_json=True))

    with pytest.raises(TMDBUnavailable):
        client.search_movies("x")


def test_auth_error_is_a_kind_of_unavailable():
    assert issubclass(TMDBAuthError, TMDBUnavailable)
