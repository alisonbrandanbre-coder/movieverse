"""Trimmed-down TMDB payloads used by the tests (shape matches the real API)."""

INTERSTELLAR_ID = 157336
INCEPTION_ID = 27205

GENRES = [
    {"id": 12, "name": "Adventure"},
    {"id": 18, "name": "Drama"},
    {"id": 878, "name": "Science Fiction"},
    {"id": 28, "name": "Action"},
]

SEARCH_INTERSTELLAR = {
    "page": 1,
    "total_pages": 1,
    "total_results": 2,
    "results": [
        {
            "id": INTERSTELLAR_ID,
            "title": "Interstellar",
            "original_title": "Interstellar",
            "overview": "The adventures of a group of explorers...",
            "release_date": "2014-11-05",
            "original_language": "en",
            "poster_path": "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
            "backdrop_path": "/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
            "popularity": 140.5,
            "vote_average": 8.4,
            "vote_count": 35000,
            "genre_ids": [12, 18, 878],
        },
        {
            "id": 301959,
            "title": "Interstellar: Nolan's Odyssey",
            "original_title": "Interstellar: Nolan's Odyssey",
            "overview": "",
            "release_date": "",
            "original_language": "en",
            "poster_path": None,
            "backdrop_path": None,
            "popularity": 3.1,
            "vote_average": 7.8,
            "vote_count": 140,
            "genre_ids": [99],
        },
    ],
}

SEARCH_EMPTY = {"page": 1, "total_pages": 0, "total_results": 0, "results": []}

INTERSTELLAR_DETAILS = {
    **SEARCH_INTERSTELLAR["results"][0],
    "runtime": 169,
    "genres": [
        {"id": 12, "name": "Adventure"},
        {"id": 18, "name": "Drama"},
        {"id": 878, "name": "Science Fiction"},
    ],
}
INTERSTELLAR_DETAILS.pop("genre_ids")

INCEPTION_DETAILS = {
    "id": INCEPTION_ID,
    "title": "Inception",
    "original_title": "Inception",
    "overview": "Cobb, a skilled thief...",
    "release_date": "2010-07-15",
    "original_language": "en",
    "poster_path": "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    "backdrop_path": "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
    "popularity": 90.0,
    "vote_average": 8.37,
    "vote_count": 37000,
    "runtime": 148,
    "genres": [{"id": 28, "name": "Action"}, {"id": 878, "name": "Science Fiction"}],
}


def _cast(n: int) -> list[dict]:
    named = [
        {"id": 10297, "name": "Matthew McConaughey", "character": "Cooper", "order": 0},
        {"id": 1813, "name": "Anne Hathaway", "character": "Brand", "order": 1},
        {"id": 83002, "name": "Jessica Chastain", "character": "Murph", "order": 2},
    ]
    extra = [
        {"id": 90000 + i, "name": f"Actor {i}", "character": f"Role {i}", "order": i}
        for i in range(3, n)
    ]
    return [{**c, "profile_path": f"/p{c['id']}.jpg"} for c in named + extra]


INTERSTELLAR_CREDITS = {
    "id": INTERSTELLAR_ID,
    # Shuffled order + a duplicated actor to exercise normalization.
    "cast": list(reversed(_cast(25)))
    + [{"id": 10297, "name": "Matthew McConaughey", "character": "Cooper (old)", "order": 99}],
    "crew": [
        {"id": 525, "name": "Christopher Nolan", "job": "Director", "profile_path": "/nolan.jpg"},
        {"id": 525, "name": "Christopher Nolan", "job": "Writer", "profile_path": "/nolan.jpg"},
        {"id": 556, "name": "Emma Thomas", "job": "Producer", "profile_path": None},
    ],
}
