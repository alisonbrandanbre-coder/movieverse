from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import serialize_result
from .services.recommendation_service import RecommendationService


class RecommendationsView(APIView):
    """The stored recommendations; regenerated when preferences or feedback changed."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tmdb"  # may query TMDB when regenerating

    def get(self, request: Request) -> Response:
        return Response(serialize_result(RecommendationService().get(request.user)))


class RefreshRecommendationsView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "recommendations"

    def post(self, request: Request) -> Response:
        return Response(serialize_result(RecommendationService().refresh(request.user)))
