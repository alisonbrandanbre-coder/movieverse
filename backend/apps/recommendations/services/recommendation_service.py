"""RecommendationService: the only place that ranks movies (docs/RULES.md).

Pipeline: taste (TasteProfileService) → candidates (CandidateService) → per-candidate
scores (scoring.py) → discovery re-ranking per section (ranking.py) → explanation
(explanations.py) → RecommendationRun + RecommendationSnapshot rows.

The stored run is reused until the user's preferences or feedback change (taste
signature), it gets older than RUN_MAX_AGE, or it was degraded by TMDB and
DEGRADED_RETRY has passed. So a like / dislike / watched / favorite changes the next
`GET /recommendations` without an explicit refresh.
"""

import random
from dataclasses import dataclass
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.common.exceptions import ServiceError
from apps.interactions.models import Interaction, InteractionType
from apps.movies.models import MoviePerson
from apps.movies.services.movie_service import MovieService
from apps.preferences.services import TasteProfileService
from apps.preferences.taste import Seed, Taste

from ..models import PopularityBucket, RecommendationRun, RecommendationSnapshot, Section
from . import scoring
from .candidates import Candidate, CandidateService
from .explanations import explain, explain_fallback
from .ranking import Scored, rerank

SECTION_SIZE = 12
MIN_SEEDED_FOR_SECTION = 4  # fewer seeded candidates → "Continuá explorando" uses the rest
CREDITS_FOR_TOP = 24  # sync credits (directors) only for the most promising candidates
MIN_QUALITY = 0.2  # never recommend a badly rated title (weighted rating < ~5.7)
GEM_MIN_QUALITY = 0.45  # a "joya" is lesser known, not bad (weighted rating ≥ ~6.6)
FALLBACK_QUALITY_WEIGHT, FALLBACK_POPULARITY_WEIGHT = 0.6, 0.4
FALLBACK_GEM_MIN_QUALITY = 0.6
RUN_MAX_AGE = timedelta(hours=24)
DEGRADED_RETRY = timedelta(minutes=10)
LESSER_KNOWN = (PopularityBucket.MEDIUM, PopularityBucket.HIDDEN)
# Surprise mode: a weighted draw among the best recommendations, never the obvious #1.
SURPRISE_POOL = 20
SURPRISE_LESSER_KNOWN_BOOST = 2.0  # MEDIUM / HIDDEN titles are twice as likely

FALLBACK_NOTICE = (
    "Todavía no completaste el onboarding: te mostramos películas populares y bien "
    "valoradas. Completalo para recibir recomendaciones personalizadas."
)
DEGRADED_NOTICE = (
    "El catálogo de TMDB no respondió del todo: las recomendaciones pueden ser menos variadas."
)


class NoSurprise(ServiceError):
    status_code = 404
    default_code = "NO_SURPRISE"
    default_detail = (
        "Todavía no tenemos una película para sorprenderte. Marcá algunas que te gusten."
    )


@dataclass(frozen=True)
class RecommendationResult:
    run: RecommendationRun
    sections: dict[str, list[RecommendationSnapshot]]

    @property
    def notice(self) -> str | None:
        if self.run.is_fallback:
            return FALLBACK_NOTICE
        if self.run.degraded:
            return DEGRADED_NOTICE
        return None


class RecommendationService:
    def __init__(self, movie_service: MovieService | None = None):
        self.movies = movie_service or MovieService()

    # ------------------------------------------------------------ public API

    def get(self, user: User) -> RecommendationResult:
        taste = TasteProfileService.taste(user)
        run = RecommendationRun.objects.filter(user=user).first()
        if self._outdated(run, taste):
            run = self._generate(user, taste)
        return self._load(run)

    def refresh(self, user: User) -> RecommendationResult:
        return self._load(self._generate(user, TasteProfileService.taste(user)))

    def surprise(
        self, user: User, exclude: frozenset[int] = frozenset(), rng: random.Random | None = None
    ) -> RecommendationSnapshot:
        """Surprise mode (EPIC 4): a random pick among the user's ~20 best recommendations.

        Not the #1 (that one is already first in Descubrir) and not `exclude` (the previous
        surprise). Watched and rejected titles are skipped even if marked after the run was
        generated. The draw is weighted by score, lesser-known titles count double. Raises
        `NoSurprise` when nothing is left.
        """
        rows = sorted(
            (row for rows in self.get(user).sections.values() for row in rows),
            key=lambda row: (-row.final_score, row.movie_id),
        )[:SURPRISE_POOL]
        marked = set(
            Interaction.objects.filter(
                user=user, type__in=[InteractionType.WATCHED, InteractionType.DISLIKE]
            ).values_list("movie_id", flat=True)
        )
        pool = [r for r in rows[1:] if r.movie_id not in marked and r.movie_id not in exclude]
        if not pool:
            raise NoSurprise()
        weights = [
            max(row.final_score, 0.01)
            * (SURPRISE_LESSER_KNOWN_BOOST if row.popularity_bucket in LESSER_KNOWN else 1.0)
            for row in pool
        ]
        return (rng or random).choices(pool, weights=weights, k=1)[0]

    def rank(self, taste: Taste) -> tuple[dict[str, list[Scored]], bool]:
        """Scored picks per section for a taste, without persisting: (sections, degraded)."""
        if not taste.onboarding_completed:
            return self._fallback(taste)
        return self._personalized(taste)

    # ------------------------------------------------------------ generation

    @staticmethod
    def _outdated(run: RecommendationRun | None, taste: Taste) -> bool:
        if run is None or run.signature != taste.signature:
            return True
        age = timezone.now() - run.generated_at
        return age > RUN_MAX_AGE or (run.degraded and age > DEGRADED_RETRY)

    def _generate(self, user: User, taste: Taste) -> RecommendationRun:
        sections, degraded = self.rank(taste)
        now = timezone.now()
        explain_item = (
            explain if taste.onboarding_completed else (lambda item, _taste: explain_fallback(item))
        )
        rows = [
            RecommendationSnapshot(
                user=user,
                movie=item.candidate.movie,
                section=section,
                position=position,
                affinity_score=item.affinity,
                novelty_score=item.novelty,
                quality_score=item.quality,
                diversity_score=item.diversity,
                exploration_score=item.exploration,
                popularity_penalty=item.penalty,
                final_score=item.final,
                popularity_bucket=item.bucket,
                explanation=explain_item(item, taste),
                generated_at=now,
            )
            for section, items in sections.items()
            for position, item in enumerate(items, start=1)
        ]
        defaults = {
            "generated_at": now,
            "signature": taste.signature,
            "discovery_level": taste.discovery_level,
            "is_fallback": not taste.onboarding_completed,
            "degraded": degraded,
        }
        for attempt in range(2):
            try:
                with transaction.atomic():
                    run, _ = RecommendationRun.objects.update_or_create(
                        user=user, defaults=defaults
                    )
                    RecommendationSnapshot.objects.filter(user=user).delete()
                    for row in rows:
                        row.run = run
                    RecommendationSnapshot.objects.bulk_create(rows)
                return run
            except IntegrityError:  # another request created the run at the same time
                if attempt:
                    raise
        raise AssertionError("unreachable")

    def _personalized(self, taste: Taste) -> tuple[dict[str, list[Scored]], bool]:
        pool = CandidateService(self.movies).personalized(taste)
        self.movies.ensure_credits([seed.movie for seed in taste.seeds])
        seed_directors = self._seed_directors(taste.seeds)
        scored = [self._score(c, taste, seed_directors) for c in pool.candidates]
        scored = [s for s in scored if s.quality >= MIN_QUALITY]

        # Directors drive the streak rule and "same director" affinity: fetch the credits
        # of the most promising candidates once, then score again.
        top = sorted(scored, key=lambda s: -s.base)[:CREDITS_FOR_TOP]
        missing = [s.candidate.movie for s in top if s.candidate.movie.credits_synced_at is None]
        if missing:
            self.movies.ensure_credits(missing)
            CandidateService.attach_directors([s.candidate for s in scored])
            scored = [self._score(s.candidate, taste, seed_directors) for s in scored]

        level = taste.discovery_level
        diversity_weight = scoring.WEIGHTS[level].diversity
        share = scoring.VERY_POPULAR_SHARE[level]

        for_you = rerank(
            scored, SECTION_SIZE, diversity_weight=diversity_weight, very_popular_share=share
        )
        used = {s.candidate.movie.pk for s in for_you}
        gems = rerank(
            [
                s
                for s in scored
                if s.bucket in LESSER_KNOWN
                and s.quality >= GEM_MIN_QUALITY
                and s.candidate.movie.pk not in used
            ],
            SECTION_SIZE,
            diversity_weight=diversity_weight,
            very_popular_share=None,
        )
        used |= {s.candidate.movie.pk for s in gems}
        rest = [s for s in scored if s.candidate.movie.pk not in used]
        seeded = [s for s in rest if s.seed is not None]
        keep = rerank(
            seeded if len(seeded) >= MIN_SEEDED_FOR_SECTION else rest,
            SECTION_SIZE,
            diversity_weight=diversity_weight,
            very_popular_share=share,
        )
        sections = {
            Section.FOR_YOU: for_you,
            Section.HIDDEN_GEMS: gems,
            Section.KEEP_EXPLORING: keep,
        }
        return sections, pool.degraded

    def _fallback(self, taste: Taste) -> tuple[dict[str, list[Scored]], bool]:
        """Explicit non-personalized list: popular and well rated."""
        pool = CandidateService(self.movies).fallback(taste)
        scored = []
        for c in pool.candidates:
            movie = c.movie
            quality = scoring.quality(movie.vote_average, movie.vote_count)
            popularity = scoring.popularity(movie.vote_count)
            scored.append(
                Scored(
                    candidate=c,
                    affinity=0.0,
                    novelty=scoring.novelty(movie.vote_count, quality),
                    quality=quality,
                    exploration=0.0,
                    penalty=0.0,
                    base=FALLBACK_QUALITY_WEIGHT * quality
                    + FALLBACK_POPULARITY_WEIGHT * popularity,
                    bucket=scoring.popularity_bucket(movie.vote_count),
                )
            )
        for_you = rerank(scored, SECTION_SIZE, diversity_weight=0.0, very_popular_share=None)
        used = {s.candidate.movie.pk for s in for_you}
        gems = rerank(
            [
                s
                for s in scored
                if s.bucket in LESSER_KNOWN
                and s.quality >= FALLBACK_GEM_MIN_QUALITY
                and s.candidate.movie.pk not in used
            ],
            SECTION_SIZE,
            diversity_weight=0.0,
            very_popular_share=None,
        )
        sections = {Section.FOR_YOU: for_you, Section.HIDDEN_GEMS: gems, Section.KEEP_EXPLORING: []}
        return sections, pool.degraded

    # ------------------------------------------------------------ scoring

    @staticmethod
    def _score(candidate: Candidate, taste: Taste, seed_directors: dict[int, Seed]) -> Scored:
        movie, level = candidate.movie, taste.discovery_level

        seed_value, seed, seed_director = 0.0, None, None
        for link in candidate.seed_links:
            value = scoring.SEED_STRENGTH[link.seed.type] * scoring.SEED_SOURCE_FACTOR[link.source]
            if value > seed_value:
                seed_value, seed, seed_director = value, link.seed, None
        for person_id, name in candidate.directors.items():
            s = seed_directors.get(person_id)
            if s is None or s.movie.pk == movie.pk:
                continue
            value = scoring.SEED_STRENGTH[s.type] * scoring.SEED_DIRECTOR_FACTOR
            if value > seed_value:
                seed_value, seed, seed_director = value, s, name

        affinity = scoring.affinity(
            genres=scoring.genre_affinity(candidate.genre_ids, taste),
            decade=scoring.decade_affinity(movie.release_date, taste),
            language=scoring.language_affinity(movie.original_language, taste),
            seed=seed_value,
        )
        quality = scoring.quality(movie.vote_average, movie.vote_count)
        novelty = scoring.novelty(movie.vote_count, quality)
        exploration = scoring.exploration(candidate.genre_ids, taste)
        penalty = scoring.popularity_penalty(movie.vote_count, level)
        return Scored(
            candidate=candidate,
            affinity=affinity,
            novelty=novelty,
            quality=quality,
            exploration=exploration,
            penalty=penalty,
            base=scoring.base_score(
                affinity=affinity,
                novelty=novelty,
                quality=quality,
                exploration=exploration,
                penalty=penalty,
                level=level,
            ),
            bucket=scoring.popularity_bucket(movie.vote_count),
            seed=seed,
            seed_director=seed_director,
        )

    @staticmethod
    def _seed_directors(seeds: list[Seed]) -> dict[int, Seed]:
        by_movie = {seed.movie.pk: seed for seed in seeds}
        rows = MoviePerson.objects.filter(
            movie_id__in=by_movie, role_type=MoviePerson.RoleType.DIRECTOR
        ).values_list("person_id", "movie_id")
        directors: dict[int, Seed] = {}
        for person_id, movie_id in rows:
            directors.setdefault(person_id, by_movie[movie_id])  # seeds are ordered by strength
        return directors

    # ------------------------------------------------------------ reading

    @staticmethod
    def _load(run: RecommendationRun) -> RecommendationResult:
        rows = RecommendationSnapshot.objects.filter(run=run).select_related("movie")
        sections: dict[str, list[RecommendationSnapshot]] = {s: [] for s in Section.values}
        for row in rows.order_by("section", "position"):
            sections[row.section].append(row)
        return RecommendationResult(run=run, sections=sections)
