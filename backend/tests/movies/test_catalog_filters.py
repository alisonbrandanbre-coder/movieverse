"""Buscar / Descubrir: streaming platforms ("Dónde verla"), country of origin, popularity,
sort order, "Ocultar las que ya vi", the minimum votes of a rating, their combination and
the caches of discover pages and watch providers."""

from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.interactions.models import Interaction, InteractionType
from apps.movies.filters import OTHER_COUNTRIES, MovieFilters
from apps.movies.models import Movie, TMDBListCache, WatchProvider
from apps.movies.services.tmdb_client import TMDBUnavailable
from apps.recommendations.services.scoring import BUCKET_THRESHOLDS
from tests.factories import make_genre

from .test_filters import page, result, titles

pytestmark = pytest.mark.django_db

SEARCH_URL = "/api/v1/movies/search"
DISCOVER_URL = "/api/v1/movies/discover"
PROVIDERS_URL = "/api/v1/movies/providers"

NETFLIX, DISNEY, MAX, MUBI = 8, 337, 1899, 11


def provider(provider_id, name, priority=1, logo="/logo.jpg"):
    return {
        "provider_id": provider_id,
        "provider_name": name,
        "logo_path": logo,
        "display_priority": priority,
    }


def region_providers(**kinds):
    """A movie's `/watch/providers` payload with an AR block."""
    return {"id": 1, "results": {"AR": {"link": "https://tmdb/watch", **kinds}, "US": {}}}


@pytest.fixture
def scifi(db):
    return make_genre("Ciencia ficción", tmdb_id=878)


def discover_params(tmdb) -> dict:
    return tmdb.discover_movies.call_args.args[0]


# ================================================================ discover params


def test_discover_platforms_countries_popularity_and_sort(auth_client, tmdb):
    tmdb.discover_movies.return_value = page([])

    response = auth_client.get(
        DISCOVER_URL,
        {
            "providers": f"{NETFLIX},{DISNEY}",
            "countries": "ar,KR",
            "popularity": "hidden",
            "sort": "oldest",
        },
    )

    assert response.status_code == 200
    params = discover_params(tmdb)
    assert params["with_watch_providers"] == "8|337"  # any of them
    assert params["watch_region"] == "AR"
    assert params["with_watch_monetization_types"] == "flatrate|free|ads"
    assert params["with_origin_country"] == "AR|KR"
    assert params["vote_count.lte"] == 799  # below the recommender's MEDIUM bucket
    assert params["sort_by"] == "primary_release_date.asc"


def test_other_countries_are_the_ones_outside_the_list(auth_client, tmdb):
    tmdb.discover_movies.return_value = page([])

    auth_client.get(DISCOVER_URL, {"countries": "MX,OTHER"})

    codes = discover_params(tmdb)["with_origin_country"].split("|")
    assert codes == ["MX", *OTHER_COUNTRIES]
    assert not {"AR", "US", "GB", "FR", "ES", "IT", "KR", "JP"} & set(codes)


def test_popularity_reuses_the_recommender_buckets():
    minimum = {bucket: votes for votes, bucket in BUCKET_THRESHOLDS}
    hidden = MovieFilters(popularity="hidden").discover_params()
    balanced = MovieFilters(popularity="balanced").discover_params()
    blockbuster = MovieFilters(popularity="blockbuster").discover_params()

    assert hidden["vote_count.lte"] == minimum["MEDIUM"] - 1
    assert (balanced["vote_count.gte"], balanced["vote_count.lte"]) == (
        minimum["MEDIUM"],
        minimum["VERY_POPULAR"] - 1,
    )
    assert blockbuster["vote_count.gte"] == minimum["VERY_POPULAR"]
    assert "vote_count.lte" not in blockbuster


@pytest.mark.parametrize(
    ("sort", "sort_by"),
    [
        ("relevance", "popularity.desc"),
        ("rating", "vote_average.desc"),
        ("newest", "primary_release_date.desc"),
        ("oldest", "primary_release_date.asc"),
        ("popular", "vote_count.desc"),
    ],
)
def test_sort_orders(sort, sort_by):
    assert MovieFilters(sort=sort).discover_params()["sort_by"] == sort_by


def test_newest_never_shows_unreleased_titles():
    params = MovieFilters(sort="newest").discover_params()
    assert params["primary_release_date.lte"] == date.today().isoformat()
    # A past decade keeps its own end.
    old = MovieFilters(sort="newest", decade=1980).discover_params()
    assert old["primary_release_date.lte"] == "1989-12-31"


def test_a_rating_needs_at_least_100_votes():
    assert MovieFilters(min_rating=7).discover_params()["vote_count.gte"] == 100
    assert MovieFilters(sort="rating").discover_params()["vote_count.gte"] == 100
    assert MovieFilters().discover_params()["vote_count.gte"] == 50


@pytest.mark.parametrize(
    "params",
    [
        {"providers": "netflix"},
        {"providers": ",".join(str(i) for i in range(1, 13))},  # more than 10
        {"countries": "BR"},
        {"popularity": "viral"},
        {"sort": "title"},
        {"hide_watched": "maybe"},
    ],
)
def test_invalid_new_filters_are_a_400(auth_client, tmdb, params):
    response = auth_client.get(DISCOVER_URL, params)

    assert response.status_code == 400
    tmdb.discover_movies.assert_not_called()


def test_all_filters_combined_in_discover(auth_client, tmdb, scifi):
    tmdb.discover_movies.return_value = page([result(1, "Uno", genres=[878], year=1994, rating=8)])

    response = auth_client.get(
        DISCOVER_URL,
        {
            "genres": scifi.pk,
            "decade": 1990,
            "rating": 7,
            "runtime": "long",
            "providers": NETFLIX,
            "countries": "US",
            "popularity": "balanced",
            "sort": "rating",
        },
    )

    assert response.status_code == 200
    params = discover_params(tmdb)
    assert params == {
        "sort_by": "vote_average.desc",
        "with_genres": "878",
        "primary_release_date.gte": "1990-01-01",
        "primary_release_date.lte": "1999-12-31",
        "vote_average.gte": 7,
        "with_runtime.gte": 120,
        "with_runtime.lte": 150,
        "with_watch_providers": "8",
        "watch_region": "AR",
        "with_watch_monetization_types": "flatrate|free|ads",
        "with_origin_country": "US",
        "vote_count.gte": 800,  # the bucket's floor wins over the rating's 100 votes
        "vote_count.lte": 14_999,
    }
    assert titles(response) == ["Uno"]


# ================================================================ discover cache


def test_discover_pages_are_cached(auth_client, tmdb):
    tmdb.discover_movies.return_value = page(
        [result(1, "Uno", genres=[], year=2000, rating=7)], total_pages=4
    )

    first = auth_client.get(DISCOVER_URL, {"countries": "AR"})
    again = auth_client.get(DISCOVER_URL, {"countries": "AR"})
    other_page = auth_client.get(DISCOVER_URL, {"countries": "AR", "page": 2})
    other_filters = auth_client.get(DISCOVER_URL, {"countries": "JP"})

    assert tmdb.discover_movies.call_count == 3  # "again" came from the cache
    assert again.json() == first.json()
    assert again.json()["total_pages"] == 4
    assert other_page.status_code == other_filters.status_code == 200


def test_a_stale_discover_page_is_refreshed_or_served_if_tmdb_fails(auth_client, tmdb):
    tmdb.discover_movies.return_value = page([result(1, "Uno", genres=[], year=2000, rating=7)])
    auth_client.get(DISCOVER_URL)
    TMDBListCache.objects.filter(key__startswith="discover:").update(
        fetched_at=timezone.now() - timedelta(hours=13)
    )
    tmdb.discover_movies.side_effect = TMDBUnavailable("down")

    response = auth_client.get(DISCOVER_URL)

    assert response.status_code == 200
    assert titles(response) == ["Uno"]
    assert tmdb.discover_movies.call_count == 2  # it tried to refresh


def test_discover_without_cache_fails_if_tmdb_fails(auth_client, tmdb):
    tmdb.discover_movies.side_effect = TMDBUnavailable("down")

    assert auth_client.get(DISCOVER_URL).status_code == 503


# ================================================================ watch providers list


def test_platforms_of_the_region_are_listed_by_priority_and_cached(auth_client, tmdb):
    tmdb.get_watch_providers.return_value = {
        "results": [
            {**provider(DISNEY, "Disney Plus", 50), "display_priorities": {"AR": 2, "US": 1}},
            {**provider(NETFLIX, "Netflix", 1), "display_priorities": {"AR": 1}},
            {**provider(MUBI, "MUBI", 3), "display_priorities": {"AR": 9}},
        ]
    }

    first = auth_client.get(PROVIDERS_URL)
    second = auth_client.get(PROVIDERS_URL)

    assert first.status_code == 200
    body = first.json()
    assert body["region"] == "AR"
    assert [p["name"] for p in body["results"]] == ["Netflix", "Disney Plus", "MUBI"]
    assert body["results"][0] == {
        "tmdb_id": NETFLIX,
        "name": "Netflix",
        "logo_url": "https://image.tmdb.org/t/p/w92/logo.jpg",
    }
    tmdb.get_watch_providers.assert_called_once_with("AR")
    assert second.json() == body


def test_argentina_gets_the_curated_streaming_services_not_stores(auth_client, tmdb):
    tmdb.get_watch_providers.return_value = {
        "results": [
            {**provider(2, "Apple TV Store"), "display_priorities": {"AR": 1}},  # rent/buy
            {**provider(MAX, "HBO Max"), "display_priorities": {"AR": 35}},
            {**provider(NETFLIX, "Netflix"), "display_priorities": {"AR": 0}},
        ]
    }

    names = [p["name"] for p in auth_client.get(PROVIDERS_URL).json()["results"]]

    assert names == ["Netflix", "HBO Max"]  # curated order; stores and unknown ones left out


def test_other_regions_get_tmdbs_priority(auth_client, tmdb, settings):
    settings.TMDB_WATCH_REGION = "UY"
    tmdb.get_watch_providers.return_value = {
        "results": [
            {**provider(MUBI, "MUBI"), "display_priorities": {"UY": 2}},
            {**provider(2, "Apple TV Store"), "display_priorities": {"UY": 1}},
        ]
    }

    body = auth_client.get(PROVIDERS_URL).json()

    assert body["region"] == "UY"
    assert [p["name"] for p in body["results"]] == ["Apple TV Store", "MUBI"]
    tmdb.get_watch_providers.assert_called_once_with("UY")


def test_platforms_list_survives_tmdb_failures(auth_client, tmdb):
    tmdb.get_watch_providers.side_effect = TMDBUnavailable("down")
    assert auth_client.get(PROVIDERS_URL).json()["results"] == []  # nothing cached yet

    tmdb.get_watch_providers.side_effect = None
    tmdb.get_watch_providers.return_value = {"results": [provider(NETFLIX, "Netflix")]}
    auth_client.get(PROVIDERS_URL)
    TMDBListCache.objects.filter(key="providers:AR").update(
        fetched_at=timezone.now() - timedelta(days=30)
    )
    tmdb.get_watch_providers.side_effect = TMDBUnavailable("down")

    assert [p["name"] for p in auth_client.get(PROVIDERS_URL).json()["results"]] == ["Netflix"]
    assert WatchProvider.objects.count() == 1


# ================================================================ "Dónde verla" of a movie


def movie_providers_url(movie: Movie) -> str:
    return f"/api/v1/movies/{movie.pk}/providers"


@pytest.fixture
def movie(auth_client, tmdb) -> Movie:
    tmdb.discover_movies.return_value = page([result(1, "Uno", genres=[], year=2000, rating=7)])
    auth_client.get(DISCOVER_URL)
    return Movie.objects.get(tmdb_id=1)


def test_where_to_watch_groups_streaming_rent_and_buy(auth_client, tmdb, movie):
    tmdb.get_movie_watch_providers.return_value = region_providers(
        flatrate=[provider(NETFLIX, "Netflix", 2)],
        ads=[provider(NETFLIX, "Netflix", 2), provider(MAX, "Max Free", 1)],
        rent=[provider(2, "Apple TV")],
        buy=[provider(3, "Google Play")],
    )

    response = auth_client.get(movie_providers_url(movie))

    assert response.status_code == 200
    body = response.json()
    assert body["region"] == "AR"
    assert body["link"] == "https://tmdb/watch"
    assert [p["name"] for p in body["streaming"]] == ["Max Free", "Netflix"]  # no duplicates
    assert [p["name"] for p in body["rent"]] == ["Apple TV"]
    assert [p["name"] for p in body["buy"]] == ["Google Play"]
    assert body["streaming"][0]["logo_url"].endswith("/w92/logo.jpg")


def test_where_to_watch_is_cached_and_served_if_tmdb_fails(auth_client, tmdb, movie):
    tmdb.get_movie_watch_providers.return_value = region_providers(
        flatrate=[provider(NETFLIX, "Netflix")]
    )
    auth_client.get(movie_providers_url(movie))
    auth_client.get(movie_providers_url(movie))
    assert tmdb.get_movie_watch_providers.call_count == 1

    Movie.objects.filter(pk=movie.pk).update(providers_synced_at=timezone.now() - timedelta(days=3))
    tmdb.get_movie_watch_providers.side_effect = TMDBUnavailable("down")
    response = auth_client.get(movie_providers_url(movie))

    assert response.status_code == 200
    assert [p["name"] for p in response.json()["streaming"]] == ["Netflix"]


def test_where_to_watch_without_offers_in_the_region(auth_client, tmdb, movie):
    tmdb.get_movie_watch_providers.return_value = {"id": 1, "results": {"US": {"flatrate": []}}}

    body = auth_client.get(movie_providers_url(movie)).json()

    assert body == {"region": "AR", "link": None, "streaming": [], "rent": [], "buy": []}


def test_where_to_watch_never_synced_and_tmdb_down_is_an_error(auth_client, tmdb, movie):
    tmdb.get_movie_watch_providers.side_effect = TMDBUnavailable("down")

    assert auth_client.get(movie_providers_url(movie)).status_code == 503


def test_where_to_watch_of_an_unknown_movie_is_a_404(auth_client, tmdb):
    assert auth_client.get("/api/v1/movies/999999/providers").status_code == 404


# ================================================================ search with the new filters


SEARCH = [
    result(1, "Moon Buenos Aires", genres=[878], year=2010, rating=7.9, votes=900),
    result(2, "Moon Seoul", genres=[878], year=2003, rating=8.4, votes=20_000),
    result(3, "Moon Hollywood", genres=[878], year=2019, rating=6.5, votes=5000),
    result(4, "Moon Berlin", genres=[18], year=2015, rating=7.0, votes=300),
    result(5, "Moon Rare", genres=[878], year=1999, rating=8.9, votes=99),  # < 100 votes
    result(6, "Moon Undated", genres=[878], year=2000, rating=7.5, votes=2000),
]
SEARCH[5]["release_date"] = ""
COUNTRIES = {1: ["AR"], 2: ["KR"], 3: ["US"], 4: ["DE"], 5: ["US"], 6: ["FR"]}
RUNTIMES = {1: 95, 2: 130, 3: 101, 4: 160, 5: 88, 6: 110}
STREAMING = {1: [NETFLIX], 2: [MUBI], 3: [NETFLIX, DISNEY], 4: [NETFLIX], 5: [], 6: [DISNEY]}


@pytest.fixture
def moon(tmdb, scifi):
    """A search whose details (country, runtime) and platforms are known by id."""
    tmdb.search_movies.return_value = page(SEARCH)

    def details(tmdb_id):
        base = next(r for r in SEARCH if r["id"] == tmdb_id)
        return {
            **{k: v for k, v in base.items() if k != "genre_ids"},
            "runtime": RUNTIMES[tmdb_id],
            "origin_country": COUNTRIES[tmdb_id],
            "genres": [{"id": g, "name": str(g)} for g in base["genre_ids"]],
        }

    tmdb.get_movie_details.side_effect = details
    tmdb.get_movie_watch_providers.side_effect = lambda tmdb_id: region_providers(
        flatrate=[provider(p, f"P{p}") for p in STREAMING[tmdb_id]]
    )
    return tmdb


def test_search_by_country_fetches_details_and_other_means_outside_the_list(auth_client, moon):
    korea = auth_client.get(SEARCH_URL, {"q": "moon", "countries": "KR,AR"})
    other = auth_client.get(SEARCH_URL, {"q": "moon", "countries": "OTHER"})

    assert titles(korea) == ["Moon Buenos Aires", "Moon Seoul"]
    assert titles(other) == ["Moon Berlin"]  # DE is not one of the listed countries
    assert Movie.objects.get(tmdb_id=2).origin_countries == ["KR"]


def test_search_by_platform_fetches_providers_only_for_candidates(auth_client, moon, scifi):
    response = auth_client.get(
        SEARCH_URL, {"q": "moon", "providers": f"{NETFLIX},{DISNEY}", "genres": scifi.pk}
    )

    assert titles(response) == ["Moon Buenos Aires", "Moon Hollywood", "Moon Undated"]
    asked = sorted(call.args[0] for call in moon.get_movie_watch_providers.call_args_list)
    assert asked == [1, 2, 3, 5, 6]  # not 4: it is not science fiction
    moon.get_movie_details.assert_not_called()  # platforms do not need the details


def test_search_by_popularity_uses_the_buckets(auth_client, moon):
    hidden = auth_client.get(SEARCH_URL, {"q": "moon", "popularity": "hidden"})
    balanced = auth_client.get(SEARCH_URL, {"q": "moon", "popularity": "balanced"})
    blockbuster = auth_client.get(SEARCH_URL, {"q": "moon", "popularity": "blockbuster"})

    assert titles(hidden) == ["Moon Berlin", "Moon Rare"]
    assert titles(balanced) == ["Moon Buenos Aires", "Moon Hollywood", "Moon Undated"]
    assert titles(blockbuster) == ["Moon Seoul"]


def test_search_rating_ignores_titles_with_less_than_100_votes(auth_client, moon):
    response = auth_client.get(SEARCH_URL, {"q": "moon", "rating": 8})

    assert titles(response) == ["Moon Seoul"]  # "Moon Rare" has 8.9 but 99 votes


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("relevance", ["Moon Buenos Aires", "Moon Seoul", "Moon Hollywood"]),
        ("rating", ["Moon Seoul", "Moon Buenos Aires", "Moon Undated"]),
        ("newest", ["Moon Hollywood", "Moon Berlin", "Moon Buenos Aires"]),
        ("oldest", ["Moon Rare", "Moon Seoul", "Moon Buenos Aires"]),
        ("popular", ["Moon Seoul", "Moon Hollywood", "Moon Undated"]),
    ],
)
def test_search_sorts_locally(auth_client, moon, sort, expected):
    response = auth_client.get(SEARCH_URL, {"q": "moon", "sort": sort})

    assert titles(response)[:3] == expected
    assert len(titles(response)) == len(SEARCH)


def test_search_sorted_puts_undated_and_barely_voted_titles_last(auth_client, moon):
    by_date = titles(auth_client.get(SEARCH_URL, {"q": "moon", "sort": "newest"}))
    by_rating = titles(auth_client.get(SEARCH_URL, {"q": "moon", "sort": "rating"}))

    assert by_date[-1] == "Moon Undated"
    assert by_rating[-1] == "Moon Rare"  # 8.9 with 99 votes


# ================================================================ "Ocultar las que ya vi"


def mark_watched(user, tmdb_id):
    Interaction.objects.create(
        user=user, movie=Movie.objects.get(tmdb_id=tmdb_id), type=InteractionType.WATCHED
    )


def test_hide_watched_in_search_only_hides_the_users_watched(auth_client, other_client, moon, user):
    auth_client.get(SEARCH_URL, {"q": "moon"})
    mark_watched(user, 2)
    Interaction.objects.create(
        user=user, movie=Movie.objects.get(tmdb_id=3), type=InteractionType.WATCHLIST
    )

    mine = auth_client.get(SEARCH_URL, {"q": "moon", "hide_watched": "true"})
    shown = auth_client.get(SEARCH_URL, {"q": "moon"})
    others = other_client.get(SEARCH_URL, {"q": "moon", "hide_watched": "true"})

    assert "Moon Seoul" not in titles(mine)
    assert "Moon Hollywood" in titles(mine)  # pending is not watched
    assert mine.json()["total_results"] == len(SEARCH) - 1
    assert "Moon Seoul" in titles(shown)
    assert "Moon Seoul" in titles(others)


def test_hide_watched_in_discover_uses_the_cached_page(auth_client, tmdb, user):
    tmdb.discover_movies.return_value = page(
        [result(i, f"Film {i}", genres=[], year=2000, rating=7) for i in (1, 2, 3)]
    )
    auth_client.get(DISCOVER_URL)
    mark_watched(user, 2)

    response = auth_client.get(DISCOVER_URL, {"hide_watched": "true"})

    assert titles(response) == ["Film 1", "Film 3"]
    assert tmdb.discover_movies.call_count == 1  # same TMDB page, filtered per user


# ================================================================ all together


def test_search_combines_every_filter(auth_client, moon, scifi, user):
    """Science fiction · 7+ (with 100+ votes) · 90–120 min · Netflix or Disney+ · AR, US
    or FR · balanced popularity · not watched · newest first."""
    auth_client.get(SEARCH_URL, {"q": "moon"})
    mark_watched(user, 6)  # would match everything else

    response = auth_client.get(
        SEARCH_URL,
        {
            "q": "moon",
            "genres": scifi.pk,
            "rating": 7,
            "runtime": "normal",
            "providers": f"{NETFLIX},{DISNEY}",
            "countries": "AR,US,FR",
            "popularity": "balanced",
            "hide_watched": "true",
            "sort": "newest",
        },
    )

    assert response.status_code == 200
    # 2: blockbuster (and KR, 130 min, MUBI) · 3: 6.5 · 4: drama · 5: 99 votes · 6: watched.
    assert titles(response) == ["Moon Buenos Aires"]
    assert response.json()["total_results"] == 1


def test_search_combined_and_relaxed(auth_client, moon, scifi):
    """Dropping the rating lets Moon Hollywood in, and the date order applies."""
    response = auth_client.get(
        SEARCH_URL,
        {
            "q": "moon",
            "genres": scifi.pk,
            "runtime": "normal",
            "providers": f"{NETFLIX},{DISNEY}",
            "countries": "AR,US,FR",
            "sort": "newest",
        },
    )

    assert titles(response) == ["Moon Hollywood", "Moon Buenos Aires", "Moon Undated"]
