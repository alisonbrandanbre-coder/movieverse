"""Moods of the Home ("¿Cómo te sentís hoy?") → TMDB `/discover/movie` filters.

The backend is the source of truth for what each mood means; the frontend only shows the
cards and the results. Genre ids are TMDB's (stable across languages): 35 Comedia,
18 Drama, 10749 Romance, 28 Acción, 53 Suspense, 878 Ciencia ficción, 9648 Misterio,
27 Terror, 12 Aventura, 16 Animación, 10751 Familia. Keyword 9672 is "based on true story".
In `with_genres`, "," means AND and "|" means OR.

To add a mood: add an entry here, a card in frontend/src/features/moods/moods.ts and a
test in tests/movies/test_home_lists.py.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Mood:
    slug: str
    label: str
    description: str
    #: Extra `/discover/movie` params; always sorted by popularity among well-voted titles.
    params: dict[str, str] = field(default_factory=dict)
    #: Local genres (TMDB ids) used when TMDB is down and nothing is cached.
    fallback_genres: tuple[int, ...] = ()


BASE_PARAMS = {"sort_by": "popularity.desc", "vote_count.gte": "400"}

MOODS: dict[str, Mood] = {
    mood.slug: mood
    for mood in (
        Mood(
            "para-reir",
            "Para reír",
            "Comedias bien valoradas para despejarte.",
            {"with_genres": "35", "without_genres": "27,53", "vote_average.gte": "6.5"},
            (35,),
        ),
        Mood(
            "para-pensar",
            "Para pensar",
            "Ciencia ficción y misterio que te dejan dando vueltas.",
            # Without action/adventure: superhero blockbusters are sci-fi too, but not "to think".
            {
                "with_genres": "878|9648",
                "without_genres": "28,12,16,10751",
                "vote_average.gte": "7.4",
            },
            (878, 9648),
        ),
        Mood(
            "adrenalina",
            "Adrenalina",
            "Acción y suspenso para no despegarte de la pantalla.",
            {"with_genres": "28|53", "without_genres": "16,10751", "vote_average.gte": "6.5"},
            (28, 53),
        ),
        Mood(
            "para-llorar",
            "Para llorar",
            "Dramas románticos que llegan al corazón.",
            {"with_genres": "18,10749", "without_genres": "35", "vote_average.gte": "7"},
            (18, 10749),
        ),
        Mood(
            "inspiradora",
            "Inspiradora",
            "Historias reales de gente que no se rindió.",
            {"with_genres": "18", "with_keywords": "9672", "vote_average.gte": "7"},
            (18,),
        ),
        Mood(
            "miedo",
            "Miedo",
            "Terror para ver con la luz prendida.",
            {"with_genres": "27", "vote_average.gte": "6.3"},
            (27,),
        ),
    )
}
