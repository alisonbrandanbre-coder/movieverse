"""Discovery re-ranking: turns scored candidates into an ordered list.

Greedy: at each position pick the candidate with the highest
    final = base_score + w.diversity · diversity
among those that respect two rules:
- popularity quota: VERY_POPULAR titles never exceed `share · n` of the first n positions
  (at least 1 is allowed), so the cap also holds for any prefix of the list;
- no streaks: a title cannot be the 4th in a row sharing a genre (or a known director)
  with the 3 before it.
If no candidate respects the streak rule it is relaxed; the quota is never relaxed (the
list ends shorter instead).

diversity = 1 − max genre Jaccard similarity with the last 5 picks, halved when the
director was already picked.
"""

import math
from dataclasses import dataclass, replace

from apps.preferences.taste import Seed

from ..models import PopularityBucket
from .candidates import Candidate

MAX_STREAK = 3
DIVERSITY_WINDOW = 5


@dataclass
class Scored:
    candidate: Candidate
    affinity: float
    novelty: float
    quality: float
    exploration: float
    penalty: float
    base: float
    bucket: str
    seed: Seed | None = None  # strongest seed behind it, for the explanation
    seed_director: str | None = None  # set when the link is "same director as the seed"
    diversity: float = 0.0
    final: float = 0.0

    @property
    def genre_ids(self) -> set[int]:
        return self.candidate.genre_ids

    @property
    def director_ids(self) -> set[int]:
        return set(self.candidate.directors)


def _jaccard(a: set[int], b: set[int]) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def diversity(item: Scored, picked: list[Scored]) -> float:
    if not picked:
        return 1.0
    recent = picked[-DIVERSITY_WINDOW:]
    value = 1.0 - max(_jaccard(item.genre_ids, p.genre_ids) for p in recent)
    if item.director_ids & {d for p in picked for d in p.director_ids}:
        value /= 2
    return value


def breaks_streak(item: Scored, picked: list[Scored]) -> bool:
    if len(picked) < MAX_STREAK:
        return False
    last = picked[-MAX_STREAK:]
    shared_genres = set(item.genre_ids)
    shared_directors = set(item.director_ids)
    for p in last:
        shared_genres &= p.genre_ids
        shared_directors &= p.director_ids
    return bool(shared_genres or shared_directors)


def very_popular_allowed(position_count: int, share: float) -> int:
    return max(1, math.floor(share * position_count))


def rerank(
    items: list[Scored],
    size: int,
    *,
    diversity_weight: float,
    very_popular_share: float | None,
) -> list[Scored]:
    """Ordered picks with `diversity` and `final` filled in (share None → no quota)."""
    remaining = sorted(items, key=lambda s: (-s.base, s.candidate.movie.pk))
    picked: list[Scored] = []
    very_popular = 0
    while remaining and len(picked) < size:
        choice = None
        for strict in (True, False):
            choice = _best(
                remaining, picked, very_popular, strict, diversity_weight, very_popular_share
            )
            if choice is not None:
                break
        if choice is None:
            break  # only VERY_POPULAR titles left and the quota is full
        remaining = [item for item in remaining if item is not choice]
        div = diversity(choice, picked)
        picked.append(replace(choice, diversity=div, final=choice.base + diversity_weight * div))
        very_popular += choice.bucket == PopularityBucket.VERY_POPULAR
    return picked


def _best(remaining, picked, very_popular, strict, diversity_weight, share) -> Scored | None:
    best, best_final = None, -math.inf
    for item in remaining:  # sorted by base: stop once even full diversity cannot win
        if item.base + diversity_weight <= best_final:
            break
        if (
            share is not None
            and item.bucket == PopularityBucket.VERY_POPULAR
            and very_popular + 1 > very_popular_allowed(len(picked) + 1, share)
        ):
            continue
        if strict and breaks_streak(item, picked):
            continue
        final = item.base + diversity_weight * diversity(item, picked)
        if final > best_final:
            best, best_final = item, final
    return best
