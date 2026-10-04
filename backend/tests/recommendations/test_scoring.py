"""Pure scoring and re-ranking rules (no DB)."""

import math
from types import SimpleNamespace

import pytest

from apps.preferences.taste import Taste, genre_weights
from apps.recommendations.services import scoring
from apps.recommendations.services.ranking import Scored, breaks_streak, rerank

LEVELS = ["FAMILIAR", "BALANCED", "EXPLORER"]


def taste(**overrides) -> Taste:
    values = {
        "onboarding_completed": True,
        "discovery_level": "BALANCED",
        "preferred_genre_ids": frozenset({1}),
        "disliked_genre_ids": frozenset(),
        "decades": frozenset(),
        "languages": frozenset(),
        "genre_weights": {1: 1.0},
        "seeds": [],
        "excluded_movie_ids": frozenset(),
        **overrides,
    }
    return Taste(**values)


# ================================================================ weights


def test_balanced_weights_are_the_spec():
    w = scoring.WEIGHTS["BALANCED"]
    assert (w.affinity, w.novelty, w.quality, w.diversity, w.exploration) == (
        0.55,
        0.20,
        0.10,
        0.10,
        0.05,
    )


@pytest.mark.parametrize("level", LEVELS)
def test_weights_add_up_to_one(level):
    w = scoring.WEIGHTS[level]
    assert math.isclose(w.affinity + w.novelty + w.quality + w.diversity + w.exploration, 1.0)


def test_explorer_increases_the_novelty_weight():
    novelty = [scoring.WEIGHTS[level].novelty for level in LEVELS]
    assert novelty == sorted(novelty) and novelty[0] < novelty[2]


def test_explorer_favors_the_novel_title_more_than_balanced():
    """Same two titles: the gap in favor of the lesser known one grows in Explorer."""

    def gap(level: str) -> float:
        def score(votes: int, average: float) -> float:
            quality = scoring.quality(average, votes)
            return scoring.base_score(
                affinity=0.7,
                novelty=scoring.novelty(votes, quality),
                quality=quality,
                exploration=0.3,
                penalty=scoring.popularity_penalty(votes, level),
                level=level,
            )

        return score(900, 7.6) - score(30_000, 8.0)

    assert gap("FAMILIAR") < gap("BALANCED") < gap("EXPLORER")


# ================================================================ quality


def test_weighted_rating_does_not_reward_a_10_with_3_votes():
    few_votes = scoring.quality(10.0, 3)
    established = scoring.quality(8.0, 20_000)

    assert few_votes < established
    # 3 votes barely move the prior (6.5).
    assert scoring.weighted_rating(10.0, 3) == pytest.approx(6.52, abs=0.01)


def test_quality_is_bounded():
    assert scoring.quality(10.0, 1_000_000) == 1.0
    assert scoring.quality(1.0, 1_000_000) == 0.0


# ================================================================ popularity


@pytest.mark.parametrize(
    ("votes", "bucket"),
    [
        (40_000, "VERY_POPULAR"),
        (15_000, "VERY_POPULAR"),
        (14_999, "POPULAR"),
        (4_000, "POPULAR"),
        (3_999, "MEDIUM"),
        (800, "MEDIUM"),
        (799, "HIDDEN"),
        (0, "HIDDEN"),
    ],
)
def test_popularity_buckets(votes, bucket):
    assert scoring.popularity_bucket(votes) == bucket


def test_popularity_penalty_grows_with_popularity_and_with_the_level():
    assert scoring.popularity_penalty(40_000, "BALANCED") > scoring.popularity_penalty(
        2_000, "BALANCED"
    )
    assert scoring.popularity_penalty(150, "BALANCED") < 0.001
    by_level = [scoring.popularity_penalty(30_000, level) for level in LEVELS]
    assert by_level == sorted(by_level) and by_level[0] < by_level[2]


def test_popularity_penalty_lowers_the_score():
    common = {"affinity": 0.8, "novelty": 0.1, "quality": 0.8, "exploration": 0.3}
    penalty = scoring.popularity_penalty(30_000, "BALANCED")

    with_penalty = scoring.base_score(**common, penalty=penalty, level="BALANCED")
    without = scoring.base_score(**common, penalty=0.0, level="BALANCED")

    assert penalty > 0
    assert with_penalty == pytest.approx(without - penalty)


# ================================================================ novelty


def test_novelty_needs_quality():
    """Unknown and bad is not a discovery: novelty requires a good weighted rating."""
    unknown_bad = scoring.novelty(400, scoring.quality(5.0, 400))
    unknown_good = scoring.novelty(400, scoring.quality(8.2, 400))
    famous_good = scoring.novelty(35_000, scoring.quality(8.4, 35_000))

    assert unknown_bad == 0.0
    assert unknown_good > 0.4
    assert famous_good < 0.1


# ================================================================ taste


def test_feedback_moves_genre_weights():
    weights = genre_weights({1}, [("LIKE", [2]), ("FAVORITE", [2, 3]), ("DISLIKE", [4])])

    assert weights[1] == 1.0  # preferred
    assert weights[2] == pytest.approx(1.0)  # 0.4 + 0.6
    assert weights[3] == pytest.approx(0.6)
    assert weights[4] == pytest.approx(-0.5)


def test_a_dislike_on_every_preferred_genre_still_counts():
    """Regression: normalizing by the max used to cancel a uniform drop."""
    weights = genre_weights({1, 2}, [("DISLIKE", [1, 2])])

    assert weights == {1: 0.5, 2: 0.5}


def test_many_likes_are_scaled_down_not_up():
    weights = genre_weights({1}, [("FAVORITE", [2])] * 5)

    assert weights[2] == 1.0
    assert weights[1] == pytest.approx(1.0 / 3.0)


# ================================================================ affinity


def test_genre_affinity_uses_weights():
    t = taste(genre_weights={1: 1.0, 2: 0.4, 3: -1.0})

    assert scoring.genre_affinity({1}, t) == 1.0
    assert scoring.genre_affinity({2}, t) == pytest.approx(0.4)
    assert scoring.genre_affinity({3}, t) == 0.0
    assert scoring.genre_affinity({1, 3}, t) < scoring.genre_affinity({1}, t)


def test_decade_and_language_affinity():
    from datetime import date

    t = taste(decades=frozenset({1990}), languages=frozenset({"ja"}))

    assert scoring.decade_affinity(date(1995, 1, 1), t) == 1.0
    assert scoring.decade_affinity(date(2003, 1, 1), t) == scoring.NEUTRAL
    assert scoring.decade_affinity(date(2020, 1, 1), t) == 0.0
    assert scoring.decade_affinity(date(2020, 1, 1), taste()) == scoring.NEUTRAL
    assert scoring.language_affinity("ja", t) == 1.0
    assert scoring.language_affinity("en", t) == 0.0


def test_exploration_is_close_but_not_identical():
    t = taste(genre_weights={1: 1.0, 2: 0.8}, disliked_genre_ids=frozenset({9}))

    assert scoring.exploration({1, 5}, t) == 1.0  # liked + a new genre
    assert scoring.exploration({1, 2}, t) == 0.3  # only known genres
    assert scoring.exploration({5, 6}, t) == 0.0  # nothing in common
    assert scoring.exploration({1, 9}, t) == 0.3  # an avoided genre is not "new"


# ================================================================ re-ranking


def item(pk: int, base: float, bucket="MEDIUM", genres=(1,), directors=()) -> Scored:
    movie = SimpleNamespace(pk=pk)
    candidate = SimpleNamespace(
        movie=movie, genre_ids=set(genres), directors={d: f"D{d}" for d in directors}
    )
    return Scored(
        candidate=candidate,
        affinity=0,
        novelty=0,
        quality=0,
        exploration=0,
        penalty=0,
        base=base,
        bucket=bucket,
    )


@pytest.mark.parametrize(("level", "limit"), [("BALANCED", 0.25), ("EXPLORER", 0.15)])
def test_very_popular_quota(level, limit):
    # Very popular titles score higher, so without a quota they would fill the list.
    pool = [item(i, 1.0 - i / 1000, "VERY_POPULAR", genres=(i % 7,)) for i in range(40)]
    pool += [item(100 + i, 0.5 - i / 1000, "MEDIUM", genres=(i % 7,)) for i in range(40)]
    share = scoring.VERY_POPULAR_SHARE[level]

    unrestricted = rerank(pool, 40, diversity_weight=0.1, very_popular_share=None)
    restricted = rerank(pool, 40, diversity_weight=0.1, very_popular_share=share)

    assert sum(s.bucket == "VERY_POPULAR" for s in unrestricted) == 40
    for size in (12, 20, 40):  # every prefix respects the cap
        prefix = restricted[:size]
        very_popular = sum(s.bucket == "VERY_POPULAR" for s in prefix)
        assert very_popular / size <= limit
    assert len(restricted) == 40


def test_quota_list_ends_shorter_rather_than_breaking_the_cap():
    pool = [item(i, 1.0 - i / 100, "VERY_POPULAR", genres=(i,)) for i in range(10)]

    picked = rerank(pool, 10, diversity_weight=0.1, very_popular_share=0.25)

    assert len(picked) == 1


def test_no_more_than_three_in_a_row_with_the_same_genre():
    pool = [item(i, 1.0 - i / 100, genres=(1,)) for i in range(10)]  # all sci-fi, best first
    pool += [item(50 + i, 0.5 - i / 100, genres=(2,)) for i in range(5)]

    picked = rerank(pool, 12, diversity_weight=0.0, very_popular_share=None)

    for i in range(3, len(picked)):
        assert not breaks_streak(picked[i], picked[i - 3 : i]), [p.genre_ids for p in picked]


def test_no_more_than_three_in_a_row_with_the_same_director():
    pool = [item(i, 1.0 - i / 100, genres=(i,), directors=(7,)) for i in range(6)]
    pool += [item(50 + i, 0.5 - i / 100, genres=(50 + i,)) for i in range(4)]

    picked = rerank(pool, 10, diversity_weight=0.0, very_popular_share=None)

    directors = [tuple(p.director_ids) for p in picked]
    assert directors[:3] == [(7,), (7,), (7,)]
    assert directors[3] == ()


def test_streak_rule_is_relaxed_when_nothing_else_is_left():
    pool = [item(i, 1.0 - i / 100, genres=(1,)) for i in range(5)]

    assert len(rerank(pool, 5, diversity_weight=0.0, very_popular_share=None)) == 5


def test_diversity_breaks_ties_in_favor_of_new_genres():
    pool = [item(1, 0.9, genres=(1,)), item(2, 0.85, genres=(1,)), item(3, 0.84, genres=(2,))]

    picked = rerank(pool, 3, diversity_weight=0.1, very_popular_share=None)

    assert [p.candidate.movie.pk for p in picked] == [1, 3, 2]
    assert picked[1].diversity == 1.0
    assert picked[1].final == pytest.approx(0.84 + 0.1)
