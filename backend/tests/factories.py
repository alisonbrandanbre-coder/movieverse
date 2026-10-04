"""Tiny builders for local catalog rows (no TMDB involved)."""

from apps.movies.models import Genre, Movie

_next_tmdb_id = iter(range(900_000, 1_000_000))


def make_genre(name: str, tmdb_id: int | None = None) -> Genre:
    return Genre.objects.create(tmdb_id=tmdb_id or next(_next_tmdb_id), name=name)


def make_movie(title: str, *, genres=(), vote_count: int = 5000, poster: bool = True, **fields):
    movie = Movie.objects.create(
        tmdb_id=fields.pop("tmdb_id", None) or next(_next_tmdb_id),
        title=title,
        vote_count=vote_count,
        poster_path=f"/{title.lower().replace(' ', '-')}.jpg" if poster else "",
        **fields,
    )
    movie.genres.set(genres)
    return movie
