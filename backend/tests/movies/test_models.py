from datetime import date

import pytest
from django.db import IntegrityError, transaction

from apps.movies.models import Genre, Movie, MoviePerson, Person

pytestmark = pytest.mark.django_db


@pytest.fixture
def movie() -> Movie:
    return Movie.objects.create(
        tmdb_id=157336, title="Interstellar", release_date=date(2014, 11, 5)
    )


def test_movie_defaults_and_helpers(movie):
    assert movie.release_year == 2014
    assert str(movie) == "Interstellar (2014)"
    assert movie.popularity == 0 and movie.vote_count == 0
    assert movie.metadata_synced_at is None and movie.credits_synced_at is None
    assert movie.created_at and movie.updated_at


def test_movie_without_release_date():
    movie = Movie.objects.create(tmdb_id=1, title="Sin fecha")

    assert movie.release_year is None
    assert str(movie) == "Sin fecha (s/f)"


def test_movie_tmdb_id_is_unique(movie):
    with pytest.raises(IntegrityError), transaction.atomic():
        Movie.objects.create(tmdb_id=157336, title="Duplicada")


def test_genre_unique_and_many_to_many(movie):
    scifi = Genre.objects.create(tmdb_id=878, name="Science Fiction")
    drama = Genre.objects.create(tmdb_id=18, name="Drama")
    movie.genres.set([scifi, drama])

    assert set(movie.genres.values_list("name", flat=True)) == {"Science Fiction", "Drama"}
    assert list(scifi.movies.all()) == [movie]
    assert str(scifi) == "Science Fiction"
    with pytest.raises(IntegrityError), transaction.atomic():
        Genre.objects.create(tmdb_id=878, name="Otra")


def test_person_unique(movie):
    nolan = Person.objects.create(tmdb_id=525, name="Christopher Nolan")

    assert str(nolan) == "Christopher Nolan"
    with pytest.raises(IntegrityError), transaction.atomic():
        Person.objects.create(tmdb_id=525, name="Otro")


def test_movie_person_roles(movie):
    nolan = Person.objects.create(tmdb_id=525, name="Christopher Nolan")
    mcc = Person.objects.create(tmdb_id=10297, name="Matthew McConaughey")
    MoviePerson.objects.create(movie=movie, person=nolan, role_type=MoviePerson.RoleType.DIRECTOR)
    MoviePerson.objects.create(
        movie=movie,
        person=mcc,
        role_type=MoviePerson.RoleType.ACTOR,
        character="Cooper",
        credit_order=0,
    )

    assert list(movie.people.order_by("name")) == [nolan, mcc]
    assert nolan.credits.get().role_type == "DIRECTOR"
    assert mcc.credits.get().character == "Cooper"
    assert "Director" in str(nolan.credits.get())


def test_movie_person_unique_per_role(movie):
    nolan = Person.objects.create(tmdb_id=525, name="Christopher Nolan")
    MoviePerson.objects.create(movie=movie, person=nolan, role_type="DIRECTOR")
    # Same person may appear with a different role (e.g. director who also acts)…
    MoviePerson.objects.create(movie=movie, person=nolan, role_type="ACTOR")
    # …but not twice with the same role.
    with pytest.raises(IntegrityError), transaction.atomic():
        MoviePerson.objects.create(movie=movie, person=nolan, role_type="DIRECTOR")


def test_deleting_movie_cascades_credits_but_keeps_people(movie):
    nolan = Person.objects.create(tmdb_id=525, name="Christopher Nolan")
    MoviePerson.objects.create(movie=movie, person=nolan, role_type="DIRECTOR")

    movie.delete()

    assert MoviePerson.objects.count() == 0
    assert Person.objects.filter(pk=nolan.pk).exists()
