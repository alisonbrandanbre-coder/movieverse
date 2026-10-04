"""Shared universes for the cinematic map (UNIVERSE connections, docs/GRAPH_SPEC.md).

A universe groups movies that are not one saga but share a fictional world (Iron Man and
Captain America, Harry Potter and Fantastic Beasts). A movie belongs to a universe when it
has one of its TMDB **keywords** or is part of one of its TMDB **collections**.

Every id here was checked against TMDB:
- keywords with `/search/keyword?query=…`, and `/discover/movie?with_keywords=<id>` must
  return the universe's movies (and nothing else);
- collections with the `belongs_to_collection` of the universe's movies.
Some universes have no usable keyword (the "harry potter" and "conjuring" keywords tag
documentaries and unrelated films), so they are defined by their collections instead.

To add a universe: find its keyword (or its sagas' collections), verify it as above, add an
entry below and a test in tests/graph/test_universes.py.
"""

from dataclasses import dataclass

from apps.movies.models import Movie


@dataclass(frozen=True)
class Universe:
    key: str
    #: Shown on the map: chip "Universo Marvel", reason "Del Universo Marvel".
    name: str
    keywords: tuple[int, ...] = ()
    collections: tuple[int, ...] = ()


UNIVERSES: tuple[Universe, ...] = (
    # keyword "marvel cinematic universe (mcu)": 80 movies, The Avengers, Iron Man, Black Panther…
    Universe("mcu", "Universo Marvel", keywords=(180547,)),
    # keyword "dc extended universe (dceu)": Man of Steel, Wonder Woman, Aquaman, Shazam!…
    Universe("dceu", "Universo DC", keywords=(229266,)),
    # collections "Harry Potter" and "Fantastic Beasts"
    Universe("wizarding-world", "Wizarding World", collections=(1241, 435259)),
    # keyword "monsterverse": Godzilla (2014), Kong: Skull Island, Godzilla vs. Kong…
    Universe("monsterverse", "MonsterVerse", keywords=(380322,)),
    # collections "The Conjuring", "Annabelle" and "The Nun"
    Universe("conjuring", "Universo de El Conjuro", collections=(313086, 402074, 968052)),
)


def universes_of(movie: Movie) -> list[Universe]:
    keywords = set(movie.keyword_ids or [])
    return [
        u
        for u in UNIVERSES
        if keywords.intersection(u.keywords) or movie.collection_tmdb_id in u.collections
    ]
