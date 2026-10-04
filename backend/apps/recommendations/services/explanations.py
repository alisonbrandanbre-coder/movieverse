"""Natural-language "¿Por qué?" for each recommendation, built from the scoring signals.

Shape: "Porque <reasons joined with "y">; <traits>." e.g.
"Porque te gustó Interstellar y preferís ciencia ficción; es menos conocida que la mayoría."
"""

from apps.preferences.constants import LANGUAGES
from apps.preferences.taste import Taste

from ..models import PopularityBucket
from .ranking import Scored

HIGH_QUALITY = 0.75
MAX_REASONS = 2  # keep it a sentence, not a report
MAX_TRAITS = 2
HIGH_GENRE_WEIGHT = 0.5

BUCKET_TRAIT = {
    PopularityBucket.HIDDEN: "es una joya poco conocida",
    PopularityBucket.MEDIUM: "es menos conocida que la mayoría",
    PopularityBucket.VERY_POPULAR: "es de las más vistas",
}


def _lower(name: str) -> str:
    return name[:1].lower() + name[1:]


def _join(parts: list[str]) -> str:
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " y " + parts[-1]


def _number(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def _decade(year: int) -> str:
    decade = year // 10 * 10
    return f"los años {str(decade)[2:] if decade < 2000 else decade}"


def rating_text(vote_average: float, vote_count: int) -> str:
    return f"{vote_average:.1f} con {_number(vote_count)} votos"


def explain(item: Scored, taste: Taste) -> str:
    movie = item.candidate.movie
    names = {g.pk: g.name for g in movie.genres.all()}
    reasons: list[str] = []

    if item.seed is not None:
        title = item.seed.movie.title
        if item.seed_director:
            reasons.append(f"la dirigió {item.seed_director}, como {title}")
        elif item.seed.type == "FAVORITE":
            reasons.append(f"tenés {title} entre tus favoritas")
        else:
            reasons.append(f"te gustó {title}")

    preferred = sorted(g for g in item.genre_ids if g in taste.preferred_genre_ids)
    learned = sorted(
        g
        for g in item.genre_ids
        if g not in taste.preferred_genre_ids and taste.genre_weights.get(g, 0) >= HIGH_GENRE_WEIGHT
    )
    if preferred:
        reasons.append("preferís " + _join([_lower(names[g]) for g in preferred[:2]]))
    elif learned:
        reasons.append("te vienen gustando las de " + _lower(names[learned[0]]))

    if movie.release_date and movie.release_date.year // 10 * 10 in taste.decades:
        reasons.append(f"es de {_decade(movie.release_date.year)}")
    if movie.original_language in taste.languages - {"en"}:
        reasons.append(
            f"está en {_lower(LANGUAGES.get(movie.original_language, movie.original_language))}"
        )

    traits: list[str] = []
    if item.bucket in BUCKET_TRAIT:
        traits.append(BUCKET_TRAIT[item.bucket])
    if item.quality >= HIGH_QUALITY:
        traits.append(f"muy bien valorada ({rating_text(movie.vote_average, movie.vote_count)})")
    new_genres = sorted(item.genre_ids - taste.positive_genre_ids - taste.disliked_genre_ids)
    if item.exploration >= 1.0 and new_genres:
        traits.append(f"te acerca a {_lower(names[new_genres[0]])}")

    reasons, traits = reasons[:MAX_REASONS], traits[:MAX_TRAITS]
    if reasons:
        text = "Porque " + _join(reasons)
        return text + ("; " + _join(traits) if traits else "") + "."
    if traits:
        sentence = _join(traits)
        return sentence[:1].upper() + sentence[1:] + "."
    return "Coincide con tu perfil."


def explain_fallback(item: Scored) -> str:
    movie = item.candidate.movie
    rating = rating_text(movie.vote_average, movie.vote_count)
    if item.bucket in (PopularityBucket.MEDIUM, PopularityBucket.HIDDEN):
        return f"Muy bien valorada y menos conocida ({rating})."
    return f"Popular y bien valorada ({rating})."
