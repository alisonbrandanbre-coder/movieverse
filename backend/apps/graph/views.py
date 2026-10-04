from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import GraphQuerySerializer, serialize_neighborhood
from .services import GraphService


class MovieGraphView(APIView):
    """A movie's neighborhood on the cinematic map: {center, nodes, edges, degraded}."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tmdb"  # may fetch filmographies / similar lists the first time

    def get(self, request: Request, movie_id: int) -> Response:
        params = GraphQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        result = GraphService().neighborhood(movie_id, limit=params.validated_data["limit"])
        return Response(serialize_neighborhood(result))
