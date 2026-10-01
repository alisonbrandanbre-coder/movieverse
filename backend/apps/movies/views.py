from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import (
    CastMemberSerializer,
    DirectorSerializer,
    MovieDetailSerializer,
    MovieSearchQuerySerializer,
    MovieSummarySerializer,
)
from .services.movie_service import MovieService


class _CatalogView(APIView):
    """Authenticated views backed by TMDB; throttled to protect the TMDB quota."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tmdb"


class MovieSearchView(_CatalogView):
    def get(self, request: Request) -> Response:
        params = MovieSearchQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        result = MovieService().search(
            query=params.validated_data["q"], page=params.validated_data["page"]
        )
        return Response(
            {
                "query": result.query,
                "page": result.page,
                "total_pages": result.total_pages,
                "total_results": result.total_results,
                "results": MovieSummarySerializer(result.movies, many=True).data,
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
