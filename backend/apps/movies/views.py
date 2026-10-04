from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.interactions.models import Interaction, InteractionType

from .moods import MOODS
from .serializers import (
    CastMemberSerializer,
    DirectorSerializer,
    MoodQuerySerializer,
    MovieCardSerializer,
    MovieDetailSerializer,
    MovieFilterQuerySerializer,
    MovieSearchQuerySerializer,
    MovieSummarySerializer,
    MovieWatchProviderSerializer,
    WatchProviderSerializer,
)
from .services.movie_service import MovieService


class _CatalogView(APIView):
    """Authenticated views backed by TMDB; throttled to protect the TMDB quota."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tmdb"


def _search_response(result) -> Response:
    return Response(
        {
            "query": result.query,
            "page": result.page,
            "total_pages": result.total_pages,
            "total_results": result.total_results,
            "results": MovieSummarySerializer(result.movies, many=True).data,
        }
    )


def _hidden_ids(request: Request, data: dict) -> frozenset[int]:
    """Movies the user marked as watched, when "Ocultar las que ya vi" is on."""
    if not data["hide_watched"]:
        return frozenset()
    return frozenset(
        Interaction.objects.filter(user=request.user, type=InteractionType.WATCHED).values_list(
            "movie_id", flat=True
        )
    )


class MovieSearchView(_CatalogView):
    """Search by title; with filters, TMDB's first pages are filtered by the backend."""

    def get(self, request: Request) -> Response:
        params = MovieSearchQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        data = params.validated_data
        return _search_response(
            MovieService().search(
                query=data["q"],
                page=data["page"],
                filters=data["filters"],
                exclude_ids=_hidden_ids(request, data),
            )
        )


class MovieDiscoverView(_CatalogView):
    """Buscar / Descubrir without text: TMDB discover with the filters (same shape as search)."""

    def get(self, request: Request) -> Response:
        params = MovieFilterQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        data = params.validated_data
        return _search_response(
            MovieService().discover(
                data["filters"], page=data["page"], exclude_ids=_hidden_ids(request, data)
            )
        )


class WatchProvidersView(_CatalogView):
    """Streaming platforms of the region, for the "Dónde verla" filter: {region, results}."""

    def get(self, request: Request) -> Response:
        providers = MovieService().watch_providers()
        return Response(
            {
                "region": settings.TMDB_WATCH_REGION,
                "results": WatchProviderSerializer(providers, many=True).data,
            }
        )


class MovieWatchProvidersView(_CatalogView):
    """Where to watch a movie in the region: {region, link, streaming, rent, buy}."""

    def get(self, request: Request, movie_id: int) -> Response:
        block = MovieService().get_movie_watch_providers(movie_id)
        return Response(
            {
                "region": settings.TMDB_WATCH_REGION,
                "link": block.get("link") or None,
                **{
                    kind: MovieWatchProviderSerializer(block.get(kind) or [], many=True).data
                    for kind in ("streaming", "rent", "buy")
                },
            }
        )


class MovieDetailView(_CatalogView):
    def get(self, request: Request, movie_id: int) -> Response:
        movie = MovieService().get_details(movie_id)
        return Response(MovieDetailSerializer(movie).data)


class MovieCreditsView(_CatalogView):
    def get(self, request: Request, movie_id: int) -> Response:
        credits = MovieService().get_credits(movie_id)
        return Response(
            {
                "directors": DirectorSerializer(credits.directors, many=True).data,
                "cast": CastMemberSerializer(credits.cast, many=True).data,
            }
        )


class TrendingMoviesView(_CatalogView):
    """Trending movies of the week: {results, degraded}."""

    def get(self, request: Request) -> Response:
        result = MovieService().trending()
        return Response(
            {
                "results": MovieCardSerializer(result.movies, many=True).data,
                "degraded": result.degraded,
            }
        )


class MoodMoviesView(_CatalogView):
    """Movies for a mood of the Home: {mood, page, has_more, results, degraded}."""

    def get(self, request: Request, slug: str) -> Response:
        params = MoodQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        result = MovieService().mood(slug, page=params.validated_data["page"])
        mood = MOODS[slug]
        return Response(
            {
                "mood": {"slug": mood.slug, "label": mood.label, "description": mood.description},
                "page": result.page,
                "has_more": result.has_more,
                "results": MovieCardSerializer(result.movies, many=True).data,
                "degraded": result.degraded,
            }
        )
