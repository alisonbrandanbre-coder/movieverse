from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    InteractionInputSerializer,
    MovieInteractionStateSerializer,
    MyMoviesQuerySerializer,
    SavedMovieSerializer,
)
from .services import InteractionService


class MovieInteractionsView(APIView):
    """GET: the current user's flags for a movie. POST {type}: set one (idempotent)."""

    def get(self, request: Request, movie_id: int) -> Response:
        state = InteractionService.state(request.user, movie_id)
        return Response(MovieInteractionStateSerializer(state).data)

    def post(self, request: Request, movie_id: int) -> Response:
        serializer = InteractionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = InteractionService.add(request.user, movie_id, serializer.validated_data["type"])
        return Response(MovieInteractionStateSerializer(state).data)


class RemoveInteractionView(APIView):
    def delete(self, request: Request, movie_id: int, interaction_type: str) -> Response:
        state = InteractionService.remove(request.user, movie_id, interaction_type.upper())
        return Response(MovieInteractionStateSerializer(state).data)


class MyMoviesView(APIView):
    interaction_type: str = ""

    def get(self, request: Request) -> Response:
        params = MyMoviesQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        result = InteractionService.movies(
            request.user, self.interaction_type, params.validated_data["page"]
        )
        return Response(
            {
                "page": result.page,
                "total_pages": result.total_pages,
                "total_results": result.total_results,
                "results": SavedMovieSerializer(result.movies, many=True).data,
            }
        )
