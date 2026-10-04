from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

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


class MovieSearchView(_CatalogView):
    """Search by title; with filters, TMDB's first pages are filtered by the backend."""

    def get(self, request: Request) -> Response:
        params = MovieSearchQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        data = params.validated_data
        return _search_response(
            MovieService().search(query=data["q"], page=data["page"], filters=data["filters"])
        )


class MovieDiscoverView(_CatalogView):
    """Buscar / Descubrir without text: TMDB discover with the filters (same shape as search)."""

    def get(self, request: Request) -> Response:
        params = MovieFilterQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        data = params.validated_data
        return _search_response(MovieService().discover(data["filters"], page=data["page"]))


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
