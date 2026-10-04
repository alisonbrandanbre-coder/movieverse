"""Pure scoring functions (no DB, no TMDB). All components are in [0, 1].

final = w.affinity·affinity + w.novelty·novelty + w.quality·quality
        + w.diversity·diversity + w.exploration·exploration − popularity_penalty

The Balanced weights are exactly docs/RECOMMENDER_SPEC.md (0.55 / 0.20 / 0.10 / 0.10 / 0.05).
Explorer moves weight from affinity to novelty and penalizes popularity harder; Familiar
moves novelty to quality (the weighted rating grows with votes, so safe bets win) and
penalizes popularity less (docs/WORKFLOW.md → Discovery level).
"""

import math
from dataclasses import dataclass
from datetime import date

from apps.preferences.models import DiscoveryLevel
from apps.preferences.taste import Taste

from ..models import PopularityBucket

L = DiscoveryLevel


@dataclass(frozen=True)
class Weights:
    affinity: float
    novelty: float
    quality: float
    diversity: float
    exploration: float


WEIGHTS: dict[str, Weights] = {
    L.FAMILIAR: Weights(
        affinity=0.60, novelty=0.05, quality=0.20, diversity=0.10, exploration=0.05
    ),
    L.BALANCED: Weights(
        affinity=0.55, novelty=0.20, quality=0.10, diversity=0.10, exploration=0.05
    ),
    L.EXPLORER: Weights(
        affinity=0.45, novelty=0.30, quality=0.10, diversity=0.10, exploration=0.05
    ),
}
# popularity_penalty = strength · popularity²  (quadratic: barely touches mid-popular titles).
PENALTY_STRENGTH: dict[str, float] = {L.FAMILIAR: 0.04, L.BALANCED: 0.10, L.EXPLORER: 0.18}
# Max share of VERY_POPULAR titles in a list.
VERY_POPULAR_SHARE: dict[str, float] = {L.FAMILIAR: 0.40, L.BALANCED: 0.25, L.EXPLORER: 0.12}

# Popularity = how known a title is, measured by TMDB vote_count (stable, unlike the
# trending `popularity`). Log scale between 100 and 40,000 votes.
POPULARITY_MIN_VOTES = 100
POPULARITY_MAX_VOTES = 40_000
BUCKET_THRESHOLDS = [  # (min votes, bucket), checked in order
    (15_000, PopularityBucket.VERY_POPULAR),
    (4_000, PopularityBucket.POPULAR),
    (800, PopularityBucket.MEDIUM),
]

# IMDb-style weighted rating: WR = v/(v+m)·R + m/(v+m)·C.
QUALITY_MIN_VOTES = 500  # m
QUALITY_PRIOR = 6.5  # C: what a title with few votes is assumed to be worth
QUALITY_FLOOR, QUALITY_CEILING = 5.0, 8.5  # WR mapped linearly to [0, 1]
# Novelty only counts for well rated titles: none at quality ≤ 0.3 (WR ≈ 6.05),
# full from quality 0.7 (WR ≈ 7.45).
NOVELTY_QUALITY_FLOOR, NOVELTY_QUALITY_SPAN = 0.3, 0.4

# Affinity components.
AFFINITY_GENRE, AFFINITY_DECADE, AFFINITY_LANGUAGE, AFFINITY_SEED = 0.45, 0.15, 0.10, 0.30
NEUTRAL = 0.5  # used when the user expressed no preference for a component
SEED_STRENGTH = {"FAVORITE": 1.0, "LIKE": 0.8}  # candidate came from that seed's TMDB lists
# TMDB "recommendations" (co-liked) are much more reliable than "similar" (keywords).
SEED_SOURCE_FACTOR = {"recommendations": 1.0, "similar": 0.6}
SEED_DIRECTOR_FACTOR = 0.85  # same director as the seed


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def popularity(vote_count: int) -> float:
    if vote_count <= POPULARITY_MIN_VOTES:
        return 0.0
    span = math.log10(POPULARITY_MAX_VOTES) - math.log10(POPULARITY_MIN_VOTES)
    return clamp((math.log10(vote_count) - math.log10(POPULARITY_MIN_VOTES)) / span)


def popularity_bucket(vote_count: int) -> str:
    for minimum, bucket in BUCKET_THRESHOLDS:
        if vote_count >= minimum:
            return bucket
    return PopularityBucket.HIDDEN


def novelty(vote_count: int, quality_score: float) -> float:
    """Lesser known AND good: being unknown alone earns nothing (docs/RECOMMENDER_SPEC.md →
    "no significa recomendar películas malas o desconocidas sin señal")."""
    gate = clamp((quality_score - NOVELTY_QUALITY_FLOOR) / NOVELTY_QUALITY_SPAN)
    return (1.0 - popularity(vote_count)) * gate


def popularity_penalty(vote_count: int, level: str) -> float:
    return PENALTY_STRENGTH[level] * popularity(vote_count) ** 2


def weighted_rating(vote_average: float, vote_count: int) -> float:
    v, m = max(vote_count, 0), QUALITY_MIN_VOTES
    return (v / (v + m)) * vote_average + (m / (v + m)) * QUALITY_PRIOR


def quality(vote_average: float, vote_count: int) -> float:
    rating = weighted_rating(vote_average, vote_count)
    return clamp((rating - QUALITY_FLOOR) / (QUALITY_CEILING - QUALITY_FLOOR))


def genre_affinity(genre_ids: set[int], taste: Taste) -> float:
    if not genre_ids:
        return 0.0
    weights = [taste.genre_weights.get(g, 0.0) for g in genre_ids]
    return clamp(0.6 * max(weights) + 0.4 * sum(weights) / len(weights))


def decade_affinity(release_date: date | None, taste: Taste) -> float:
    if not taste.decades:
        return NEUTRAL
    if release_date is None:
        return NEUTRAL / 2
    decade = release_date.year // 10 * 10
    if decade in taste.decades:
        return 1.0
    if decade - 10 in taste.decades or decade + 10 in taste.decades:
        return NEUTRAL
    return 0.0


def language_affinity(language: str, taste: Taste) -> float:
    if not taste.languages:
        return NEUTRAL
    return 1.0 if language in taste.languages else 0.0


def affinity(genres: float, decade: float, language: float, seed: float) -> float:
    return clamp(
        AFFINITY_GENRE * genres
        + AFFINITY_DECADE * decade
        + AFFINITY_LANGUAGE * language
        + AFFINITY_SEED * seed
    )


def exploration(genre_ids: set[int], taste: Taste) -> float:
    """Close but not identical: shares a liked genre and adds one the user has not explored."""
    positive = taste.positive_genre_ids
    if not genre_ids & positive:
        return 0.0
    new = genre_ids - positive - taste.disliked_genre_ids
    return 1.0 if new else 0.3


def base_score(
    *,
    affinity: float,
    novelty: float,
    quality: float,
    exploration: float,
    penalty: float,
    level: str,
) -> float:
    """Everything except diversity, which depends on what was already picked."""
    w = WEIGHTS[level]
    return (
        w.affinity * affinity
        + w.novelty * novelty
        + w.quality * quality
        + w.exploration * exploration
        - penalty
    )
