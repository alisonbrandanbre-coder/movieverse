"""RecommendationService through the API: exclusions, feedback, fallback, TMDB failures."""

import pytest

from apps.interactions.models import Interaction
from apps.movies.models import TMDBListCache
from apps.movies.services.tmdb_client import TMDBUnavailable
from apps.recommendations.models import RecommendationRun, RecommendationSnapshot
from apps.recommendations.services import scoring
from tests.factories import make_movie

pytestmark = pytest.mark.django_db

URL = "/api/v1/recommendations"
REFRESH_URL = "/api/v1/recommendations/refresh"


def all_titles(body) -> list[str]:
    return [i["movie"]["title"] for s in body["sections"] for i in s["items"]]


def section(body, key: str) -> list[dict]:
    return next(s["items"] for s in body["sections"] if s["key"] == key)


def titles(body, key: str) -> list[str]:
    return [i["movie"]["title"] for i in section(body, key)]


def tmdb_summary(tmdb_id: int, title: str, genre_tmdb_ids, votes=3000, average=7.5) -> dict:
    return {
        "id": tmdb_id,
        "title": title,
        "release_date": "2010-05-01",
        "original_language": "en",
        "poster_path": f"/{tmdb_id}.jpg",
        "vote_count": votes,
        "vote_average": average,
        "popularity": 50,
        "genre_ids": list(genre_tmdb_ids),
    }


@pytest.fixture
def catalog(genres):
    """A small local catalog with every bucket."""
    g = genres
    return {
        "Interstellar": make_movie(
            "Interstellar",
            genres=[g["Ciencia ficción"], g["Aventura"]],
            vote_count=36_000,
            vote_average=8.4,
            release_date="2014-11-05",
        ),
        "Primer": make_movie(
            "Primer",
            genres=[g["Ciencia ficción"], g["Suspense"]],
            vote_count=2_100,
            vote_average=6.9,
            release_date="2004-10-08",
        ),
        "Moon": make_movie(
            "Moon",
            genres=[g["Ciencia ficción"], g["Drama"]],
            vote_count=5_500,
            vote_average=7.6,
            release_date="2009-06-12",
        ),
        "Coherence": make_movie(
            "Coherence",
            genres=[g["Ciencia ficción"], g["Suspense"]],
            vote_count=2_900,
            vote_average=7.0,
            release_date="2013-09-19",
        ),
        "Matrix": make_movie(
            "Matrix",
            genres=[g["Ciencia ficción"]],
            vote_count=26_000,
            vote_average=8.2,
            release_date="1999-03-31",
        ),
        "Zodiac": make_movie(
            "Zodiac",
            genres=[g["Suspense"], g["Drama"]],
            vote_count=11_000,
            vote_average=7.5,
            release_date="2007-03-02",
        ),
        "Superbad": make_movie(
            "Superbad",
            genres=[g["Comedia"]],
            vote_count=7_800,
            vote_average=7.2,
            release_date="2007-08-17",
        ),
        "Hot Fuzz": make_movie(
            "Hot Fuzz",
            genres=[g["Comedia"], g["Suspense"]],
            vote_count=7_300,
            vote_average=7.4,
            release_date="2007-02-14",
        ),
        "Saw": make_movie(
            "Saw",
            genres=[g["Terror"], g["Suspense"]],
            vote_count=9_000,
            vote_average=7.3,
            release_date="2004-10-01",
        ),
        "Poco votada": make_movie(
            "Poco votada",
            genres=[g["Ciencia ficción"]],
            vote_count=40,
            vote_average=9.5,
        ),
        "Futura": make_movie(
            "Futura",
            genres=[g["Ciencia ficción"]],
            vote_count=900,
            vote_average=7.0,
            release_date="2099-01-01",
        ),
    }


@pytest.fixture
def scifi_user(user, genres, onboard):
    onboard(
        user, preferred=[genres["Ciencia ficción"], genres["Suspense"]], disliked=[genres["Terror"]]
    )
    return user


# ================================================================ auth / isolation


@pytest.mark.parametrize(("method", "url"), [("get", URL), ("post", REFRESH_URL)])
def test_endpoints_require_authentication(api_client, method, url):
    response = getattr(api_client, method)(url)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"
    assert RecommendationRun.objects.count() == 0


def test_users_only_get_their_own_recommendations(
    auth_client, other_client, scifi_user, other_user, catalog, tmdb
):
    Interaction.objects.create(user=other_user, movie=catalog["Primer"], type="WATCHED")

    mine = auth_client.get(URL).json()
    theirs = other_client.get(URL).json()

    assert "Primer" in all_titles(mine)  # another user's "watched" does not affect me
    assert theirs["is_fallback"] is True  # the other user has no onboarding
    assert "Primer" not in all_titles(theirs)
    assert RecommendationSnapshot.objects.filter(user=scifi_user).count() == len(all_titles(mine))


# ================================================================ response


def test_response_shape_and_score_breakdown(auth_client, scifi_user, catalog, tmdb):
    response = auth_client.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert body["is_fallback"] is False
    assert body["degraded"] is False
    assert body["notice"] is None
    assert body["discovery_level"] == "BALANCED"
    assert [s["key"] for s in body["sections"]] == ["FOR_YOU", "HIDDEN_GEMS", "KEEP_EXPLORING"]
    first = section(body, "FOR_YOU")[0]
    assert set(first) == {"movie", "position", "popularity_bucket", "explanation", "scores"}
    assert set(first["movie"]) == {
        "id",
        "tmdb_id",
        "title",
        "release_year",
        "poster_url",
        "vote_average",
    }
    assert first["position"] == 1
    assert first["explanation"]

    # final = weighted sum − penalty (diversity included), with the Balanced weights.
    w = scoring.WEIGHTS["BALANCED"]
    s = first["scores"]
    expected = (
        w.affinity * s["affinity"]
        + w.novelty * s["novelty"]
        + w.quality * s["quality"]
        + w.diversity * s["diversity"]
        + w.exploration * s["exploration"]
        - s["popularity_penalty"]
    )
    assert s["final"] == pytest.approx(expected, abs=1e-3)


def test_snapshots_are_persisted(auth_client, scifi_user, catalog, tmdb):
    body = auth_client.get(URL).json()

    run = RecommendationRun.objects.get(user=scifi_user)
    rows = RecommendationSnapshot.objects.filter(run=run)
    assert rows.count() == len(all_titles(body))
    row = rows.get(section="FOR_YOU", position=1)
    assert row.explanation == section(body, "FOR_YOU")[0]["explanation"]
    assert row.final_score == pytest.approx(
        section(body, "FOR_YOU")[0]["scores"]["final"], abs=1e-4
    )


# ================================================================ exclusions


def test_never_recommends_watched_disliked_or_avoided_genres(
    auth_client, scifi_user, catalog, tmdb, genres
):
    Interaction.objects.create(user=scifi_user, movie=catalog["Moon"], type="WATCHED")
    Interaction.objects.create(user=scifi_user, movie=catalog["Coherence"], type="DISLIKE")
    # Even when TMDB lists bring them back.
    tmdb.discover_movies.return_value = {
        "results": [
            tmdb_summary(catalog["Moon"].tmdb_id, "Moon", [878]),
            tmdb_summary(catalog["Coherence"].tmdb_id, "Coherence", [878]),
            tmdb_summary(catalog["Saw"].tmdb_id, "Saw", [27, 53]),
        ]
    }

    shown = all_titles(auth_client.get(URL).json())

    assert shown  # there are recommendations
    assert "Moon" not in shown
    assert "Coherence" not in shown
    assert "Saw" not in shown  # Terror is a genre to avoid
    assert "Poco votada" not in shown  # no signal
    assert "Futura" not in shown  # not released


def test_does_not_recommend_what_the_user_already_saved(auth_client, scifi_user, catalog, tmdb):
    for title, type_ in [("Primer", "FAVORITE"), ("Matrix", "LIKE"), ("Zodiac", "WATCHLIST")]:
        Interaction.objects.create(user=scifi_user, movie=catalog[title], type=type_)

    shown = all_titles(auth_client.get(URL).json())

    assert not {"Primer", "Matrix", "Zodiac"} & set(shown)


def test_a_movie_appears_in_one_section_only(auth_client, scifi_user, catalog, tmdb):
    shown = all_titles(auth_client.get(URL).json())

    assert len(shown) == len(set(shown))


# ================================================================ feedback


def test_like_changes_the_ranking(auth_client, scifi_user, catalog, tmdb, genres):
    before = all_titles(auth_client.get(URL).json())
    # Liking comedies teaches MovieVerse a new taste (the like itself is excluded).
    liked = make_movie("Comedia ya vista", genres=[genres["Comedia"]], vote_count=6000)
    auth_client.post(f"/api/v1/movies/{liked.pk}/interactions", {"type": "LIKE"}, format="json")

    after = all_titles(auth_client.get(URL).json())

    assert after != before

    def position(titles, title):
        return titles.index(title) if title in titles else len(titles)

    assert position(after, "Superbad") < position(before, "Superbad")


def test_dislike_excludes_the_title_and_lowers_its_genres(auth_client, scifi_user, catalog, tmdb):
    first = auth_client.get(URL).json()
    top = section(first, "FOR_YOU")[0]["movie"]
    top_affinity = {
        i["movie"]["title"]: i["scores"]["affinity"] for s in first["sections"] for i in s["items"]
    }

    auth_client.post(f"/api/v1/movies/{top['id']}/interactions", {"type": "DISLIKE"}, format="json")
    after = auth_client.get(URL).json()

    assert top["title"] not in all_titles(after)
    after_affinity = {
        i["movie"]["title"]: i["scores"]["affinity"] for s in after["sections"] for i in s["items"]
    }
    common = set(top_affinity) & set(after_affinity)
    assert any(after_affinity[t] < top_affinity[t] for t in common)


def test_watched_is_excluded_on_the_next_get_without_refresh(
    auth_client, scifi_user, catalog, tmdb
):
    first = auth_client.get(URL).json()
    title = section(first, "FOR_YOU")[0]["movie"]
    run_before = RecommendationRun.objects.get(user=scifi_user).generated_at

    auth_client.post(
        f"/api/v1/movies/{title['id']}/interactions", {"type": "WATCHED"}, format="json"
    )
    after = auth_client.get(URL).json()

    assert title["title"] not in all_titles(after)
    assert RecommendationRun.objects.get(user=scifi_user).generated_at > run_before


def test_favorite_seed_brings_tmdb_recommendations_with_explanation(
    auth_client, scifi_user, catalog, tmdb, genres
):
    Interaction.objects.create(user=scifi_user, movie=catalog["Interstellar"], type="FAVORITE")
    tmdb.get_movie_recommendations.return_value = {
        "results": [tmdb_summary(555, "Contacto", [878, 18], votes=3500, average=7.5)]
    }

    body = auth_client.get(URL).json()

    tmdb.get_movie_recommendations.assert_called_with(catalog["Interstellar"].tmdb_id)
    item = next(
        i for s in body["sections"] for i in s["items"] if i["movie"]["title"] == "Contacto"
    )
    assert item["explanation"].startswith(
        "Porque tenés Interstellar entre tus favoritas y preferís ciencia ficción"
    )
    assert "es menos conocida que la mayoría" in item["explanation"]
    assert item["scores"]["affinity"] > 0.6


def test_get_reuses_the_stored_run_until_something_changes(auth_client, scifi_user, catalog, tmdb):
    auth_client.get(URL)
    generated = RecommendationRun.objects.get(user=scifi_user).generated_at

    auth_client.get(URL)

    assert RecommendationRun.objects.get(user=scifi_user).generated_at == generated


def test_refresh_regenerates(auth_client, scifi_user, catalog, tmdb):
    auth_client.get(URL)
    generated = RecommendationRun.objects.get(user=scifi_user).generated_at

    response = auth_client.post(REFRESH_URL)

    assert response.status_code == 200
    assert RecommendationRun.objects.get(user=scifi_user).generated_at > generated


def test_changing_preferences_regenerates(auth_client, scifi_user, catalog, tmdb, genres):
    before = auth_client.get(URL).json()
    auth_client.put(
        "/api/v1/preferences",
        {"preferred_genres": [genres["Comedia"].pk], "discovery_level": "EXPLORER"},
        format="json",
    )

    after = auth_client.get(URL).json()

    assert after["discovery_level"] == "EXPLORER"
    assert titles(after, "FOR_YOU")[0] in {"Superbad", "Hot Fuzz"}
    assert titles(after, "FOR_YOU") != titles(before, "FOR_YOU")


# ================================================================ discovery level / buckets


def test_hidden_gems_are_medium_or_hidden_and_decent(
    auth_client, scifi_user, catalog, tmdb, genres
):
    for i in range(20):
        make_movie(
            f"Joya {i}", genres=[genres["Ciencia ficción"]], vote_count=600 + i, vote_average=7.8
        )
    make_movie("Joya mala", genres=[genres["Ciencia ficción"]], vote_count=700, vote_average=4.5)

    body = auth_client.get(URL).json()
    gems = section(body, "HIDDEN_GEMS")

    assert gems
    assert {i["popularity_bucket"] for i in gems} <= {"MEDIUM", "HIDDEN"}
    assert "Joya mala" not in all_titles(body)  # lesser known AND bad is not a gem


@pytest.mark.parametrize(("level", "max_share"), [("BALANCED", 0.25), ("EXPLORER", 0.15)])
def test_bucket_shares_in_for_you(auth_client, user, genres, onboard, tmdb, level, max_share):
    onboard(user, preferred=[genres["Ciencia ficción"]], level=level)
    scifi = genres["Ciencia ficción"]
    others = [genres["Drama"], genres["Aventura"], genres["Suspense"]]
    for i in range(20):  # very popular, excellent: they would take the whole list
        make_movie(
            f"Taquillera {i}",
            genres=[scifi, others[i % 3]],
            vote_count=30_000 + i,
            vote_average=8.3,
        )
    for i in range(20):
        make_movie(
            f"Mediana {i}", genres=[scifi, others[i % 3]], vote_count=2_000 + i, vote_average=7.0
        )

    items = section(auth_client.get(URL).json(), "FOR_YOU")
    very_popular = sum(i["popularity_bucket"] == "VERY_POPULAR" for i in items)

    assert len(items) == 12
    assert very_popular / len(items) <= max_share


def test_explorer_shows_more_lesser_known_titles_than_familiar(user, genres, onboard, tmdb):
    import dataclasses

    from apps.preferences.services import TasteProfileService
    from apps.recommendations.services.recommendation_service import RecommendationService

    onboard(user, preferred=[genres["Ciencia ficción"]])
    scifi = genres["Ciencia ficción"]
    others = [genres["Drama"], genres["Aventura"], genres["Suspense"]]
    for i in range(15):
        make_movie(
            f"Popular {i}",
            genres=[scifi, others[i % 3]],
            vote_count=8_000 + 1000 * i,
            vote_average=7.8,
        )
        make_movie(
            f"Menos conocida {i}",
            genres=[scifi, others[i % 3]],
            vote_count=1_200 + 50 * i,
            vote_average=7.3,
        )
    taste = TasteProfileService.taste(user)

    def lesser_known(level):
        sections, _ = RecommendationService().rank(
            dataclasses.replace(taste, discovery_level=level)
        )
        return sum(s.bucket in ("MEDIUM", "HIDDEN") for s in sections["FOR_YOU"])

    assert lesser_known("FAMILIAR") < lesser_known("EXPLORER")


def test_no_four_in_a_row_with_the_same_genre(auth_client, user, genres, onboard, tmdb):
    onboard(user, preferred=[genres["Ciencia ficción"], genres["Comedia"]])
    for i in range(12):
        make_movie(
            f"Sci-fi {i}", genres=[genres["Ciencia ficción"]], vote_count=3000 + i, vote_average=7.8
        )
    for i in range(6):
        make_movie(
            f"Comedia {i}", genres=[genres["Comedia"]], vote_count=3000 + i, vote_average=6.8
        )

    items = section(auth_client.get(URL).json(), "FOR_YOU")
    kinds = ["S" if i["movie"]["title"].startswith("Sci-fi") else "C" for i in items]

    assert "SSSS" not in "".join(kinds) and "CCCC" not in "".join(kinds)


# ================================================================ TMDB and cache


def test_tmdb_down_does_not_break_the_api(auth_client, scifi_user, catalog, tmdb):
    for method in (
        "discover_movies",
        "get_movie_recommendations",
        "get_similar_movies",
        "get_movie_credits",
    ):
        getattr(tmdb, method).side_effect = TMDBUnavailable("down")
    Interaction.objects.create(user=scifi_user, movie=catalog["Interstellar"], type="LIKE")

    response = auth_client.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert "TMDB" in body["notice"]
    assert section(body, "FOR_YOU")  # served from the local catalog


def test_tmdb_down_with_empty_catalog_returns_empty_sections(auth_client, scifi_user, tmdb):
    tmdb.discover_movies.side_effect = TMDBUnavailable("down")

    response = auth_client.get(URL)

    assert response.status_code == 200
    assert all(s["items"] == [] for s in response.json()["sections"])


def test_tmdb_lists_are_cached_between_refreshes(auth_client, scifi_user, catalog, tmdb):
    Interaction.objects.create(user=scifi_user, movie=catalog["Interstellar"], type="LIKE")
    auth_client.post(REFRESH_URL)
    calls = (tmdb.discover_movies.call_count, tmdb.get_movie_recommendations.call_count)

    auth_client.post(REFRESH_URL)

    assert calls[0] > 0 and calls[1] == 1
    assert (tmdb.discover_movies.call_count, tmdb.get_movie_recommendations.call_count) == calls
    assert TMDBListCache.objects.count() == calls[0] + 2  # + recommendations + similar


def test_discover_queries_use_preferences(auth_client, user, genres, onboard, tmdb):
    onboard(
        user,
        preferred=[genres["Ciencia ficción"]],
        disliked=[genres["Terror"]],
        decades=[1990],
        languages=["ja"],
    )

    auth_client.get(URL)

    params = [c.args[0] for c in tmdb.discover_movies.call_args_list]
    assert all(p["without_genres"] == "27" for p in params)
    assert any(p.get("with_genres") == 878 for p in params)
    assert any(p.get("primary_release_date.gte") == "1990-01-01" for p in params)
    assert any(p.get("with_original_language") == "ja" for p in params)


def test_tmdb_results_become_candidates(auth_client, scifi_user, tmdb):
    tmdb.discover_movies.return_value = {
        "results": [tmdb_summary(901, "Arrival", [878, 18], votes=19_000, average=7.6)]
    }
    tmdb.get_genres.return_value = [
        {"id": 878, "name": "Ciencia ficción"},
        {"id": 18, "name": "Drama"},
    ]

    shown = all_titles(auth_client.get(URL).json())

    assert "Arrival" in shown


# ================================================================ fallback


def test_fallback_when_onboarding_is_incomplete(auth_client, user, catalog, tmdb):
    Interaction.objects.create(user=user, movie=catalog["Matrix"], type="WATCHED")

    body = auth_client.get(URL).json()

    assert body["is_fallback"] is True
    assert "onboarding" in body["notice"]
    for_you = section(body, "FOR_YOU")
    assert for_you
    assert "Matrix" not in all_titles(body)  # exclusions still apply
    assert for_you[0]["movie"]["title"] == "Interstellar"  # most voted and best rated
    assert for_you[0]["explanation"].startswith("Popular y bien valorada (8.4 con 36.000 votos)")
    assert section(body, "KEEP_EXPLORING") == []
    assert {i["scores"]["affinity"] for i in for_you} == {0.0}


def test_completing_onboarding_leaves_the_fallback(
    auth_client, user, catalog, tmdb, genres, onboard
):
    assert auth_client.get(URL).json()["is_fallback"] is True

    onboard(user, preferred=[genres["Comedia"]])
    body = auth_client.get(URL).json()

    assert body["is_fallback"] is False
    assert titles(body, "FOR_YOU")[0] in {"Superbad", "Hot Fuzz"}
