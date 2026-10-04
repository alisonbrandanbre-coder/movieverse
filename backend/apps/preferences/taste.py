"""The user's taste as the recommender sees it: explicit preferences + feedback signals.

Built only by `TasteProfileService.taste()` (docs/RULES.md: TasteProfileService concentra la
actualización de gustos). Signal weights follow docs/WORKFLOW.md → Feedback.
"""

import hashlib
from dataclasses import dataclass, field

from apps.interactions.models import InteractionType
from apps.movies.models import Movie

T = InteractionType

# How much each signal moves the weight of the genres of the movie it touches.
PREFERRED_GENRE_SIGNAL = 1.0  # chosen in the onboarding
GENRE_SIGNALS: dict[str, float] = {
    T.FAVORITE: 0.6,  # strong positive
    T.LIKE: 0.4,
    T.WATCHLIST: 0.2,  # moderate interest
    T.WATCHED: 0.1,  # saw it, no opinion
    T.DISLIKE: -0.5,  # reduces affinity
}
# Seeds: movies whose TMDB recommendations become candidates ("porque te gustó X").
SEED_TYPES = (T.FAVORITE, T.LIKE)
MAX_SEEDS = 5


@dataclass(frozen=True)
class Seed:
    movie: Movie
    type: str  # FAVORITE | LIKE


@dataclass(frozen=True)
class Taste:
    onboarding_completed: bool
    discovery_level: str
    preferred_genre_ids: frozenset[int]
    disliked_genre_ids: frozenset[int]  # hard exclusion
    decades: frozenset[int]
    languages: frozenset[str]
    # Genre id → weight in [-1, 1]: preferred genres and feedback, normalized by the max.
    genre_weights: dict[int, float]
    seeds: list[Seed]
    # Movies the user already knows or rejected: never recommended.
    excluded_movie_ids: frozenset[int]
    # Changes whenever preferences or feedback change: recommendations are regenerated.
    signature: str = field(default="")

    @property
    def positive_genre_ids(self) -> frozenset[int]:
        return frozenset(g for g, w in self.genre_weights.items() if w >= 0.25)


def genre_weights(preferred: set[int], signals: list[tuple[str, list[int]]]) -> dict[int, float]:
    """Accumulate signals per genre, scaled into [-1, 1].

    Totals are only scaled *down* (when likes push a genre above 1). Never scaling up keeps
    a dislike visible even when it hits every preferred genre at once.
    """
    raw: dict[int, float] = dict.fromkeys(preferred, PREFERRED_GENRE_SIGNAL)
    for interaction_type, genre_ids in signals:
        for genre_id in genre_ids:
            raw[genre_id] = raw.get(genre_id, 0.0) + GENRE_SIGNALS[interaction_type]
    scale = max(1.0, *raw.values()) if raw else 1.0
    return {g: max(-1.0, min(1.0, w / scale)) for g, w in raw.items()}


def signature(*parts: object) -> str:
    return hashlib.sha1(repr(parts).encode()).hexdigest()
