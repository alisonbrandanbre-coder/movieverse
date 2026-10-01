import pytest

from apps.movies.exceptions import CatalogUnavailable, MovieNotFound
from apps.movies.models import Movie
from apps.movies.services.images import build_image_url, poster_url
from apps.movies.services.movie_service import MovieService
from apps.movies.services.normalizers import (
    normalize_credits,
    normalize_movie,
    normalize_movie_details,
    parse_date,
)
from apps.movies.services.tmdb_client import TMDBNotFound, TMDBUnavailable

from . import tmdb_payloads as payloads

# ================================================================ persistence


@pytest.mark.django_db
def test_get_or_create_from_tmdb_creates_once(tmdb):
    service = MovieService()

    first = service.get_or_create_from_tmdb(payloads.INTERSTELLAR_ID)
    second = service.get_or_create_from_tmdb(payloads.INTERSTELLAR_ID)

    assert first.pk == second.pk
    assert Movie.objects.count() == 1
    tmdb.get_movie_details.assert_called_once_with(payloads.INTERSTELLAR_ID)
    assert first.runtime == 169
    assert first.metadata_synced_at is not None
    assert set(first.genres.values_list("name", flat=True)) == {
        "Adventure",
        "Drama",
        "Science Fiction",
    }


@pytest.mark.django_db
def test_get_or_create_reuses_movie_saved_by_search(tmdb):
    service = MovieService()
    searched = service.search("interstellar").movies[0]

    movie = service.get_or_create_from_tmdb(payloads.INTERSTELLAR_ID)

    assert movie.pk == searched.pk
    tmdb.get_movie_details.assert_not_called()


@pytest.mark.django_db
def test_get_or_create_not_found(tmdb):
    tmdb.get_movie_details.side_effect = TMDBNotFound("/movie/1")

    with pytest.raises(MovieNotFound):
        MovieService().get_or_create_from_tmdb(1)
    assert Movie.objects.count() == 0


@pytest.mark.django_db
def test_get_or_create_tmdb_down(tmdb):
    tmdb.get_movie_details.side_effect = TMDBUnavailable("down")

    with pytest.raises(CatalogUnavailable):
        MovieService().get_or_create_from_tmdb(1)


@pytest.mark.django_db
def test_sync_metadata_updates_genres(tmdb):
    service = MovieService()
    movie = service.get_or_create_from_tmdb(payloads.INTERSTELLAR_ID)
    tmdb.get_movie_details.return_value = {
        **payloads.INTERSTELLAR_DETAILS,
        "genres": [{"id": 878, "name": "Ciencia ficción"}],
        "vote_average": 8.5,
    }

    movie = service.sync_metadata(movie)

    assert list(movie.genres.values_list("name", flat=True)) == ["Ciencia ficción"]
    assert movie.vote_average == 8.5


# ================================================================ normalizers


def test_parse_date_handles_empty_and_invalid():
    assert parse_date("2014-11-05").year == 2014
    assert parse_date("") is None
    assert parse_date(None) is None
    assert parse_date("11/05/2014") is None


def test_normalize_movie_tolerates_missing_and_null_fields():
    fields = normalize_movie({"id": 1, "original_title": "Solo original", "vote_count": None})

    assert fields["title"] == "Solo original"
    assert fields["poster_path"] == ""
    assert fields["release_date"] is None
    assert fields["vote_count"] == 0
    assert fields["popularity"] == 0


def test_normalize_details_runtime_zero_is_unknown():
    assert normalize_movie_details({"id": 1, "title": "x", "runtime": 0})["runtime"] is None


def test_normalize_credits_orders_and_limits_cast():
    credits = normalize_credits(payloads.INTERSTELLAR_CREDITS, cast_limit=5)

    assert [d.name for d in credits.directors] == ["Christopher Nolan"]
    assert [c.name for c in credits.cast][:3] == [
        "Matthew McConaughey",
        "Anne Hathaway",
        "Jessica Chastain",
    ]
    assert len(credits.cast) == 5
    assert [c.order for c in credits.cast] == [0, 1, 2, 3, 4]


# ================================================================ images


def test_image_urls_are_built_from_paths():
    assert poster_url("/abc.jpg") == "https://image.tmdb.org/t/p/w500/abc.jpg"
    assert build_image_url("abc.jpg", "original") == "https://image.tmdb.org/t/p/original/abc.jpg"
    assert poster_url("") is None
    assert poster_url(None) is None
