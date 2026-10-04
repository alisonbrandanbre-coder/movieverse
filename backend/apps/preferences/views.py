from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.movies.serializers import MovieSummarySerializer

from .serializers import (
    OnboardingInputSerializer,
    OnboardingSampleQuerySerializer,
    PreferenceOptionsSerializer,
    PreferencesInputSerializer,
    PreferencesSerializer,
)
from .services import TasteProfileService


class PreferencesView(APIView):
    def get(self, request: Request) -> Response:
        profile = TasteProfileService.get_profile(request.user)
        return Response(PreferencesSerializer(profile).data)

    def put(self, request: Request) -> Response:
        serializer = PreferencesInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = TasteProfileService.update(request.user, serializer.validated_data)
        return Response(PreferencesSerializer(profile).data)


class OnboardingView(APIView):
    def post(self, request: Request) -> Response:
        serializer = OnboardingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        ratings = data.pop("ratings")
        profile = TasteProfileService.complete_onboarding(request.user, data, ratings)
        return Response(PreferencesSerializer(profile).data, status=status.HTTP_200_OK)


class PreferenceOptionsView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tmdb"  # may load TMDB's genre list the first time

    def get(self, request: Request) -> Response:
        return Response(PreferenceOptionsSerializer(TasteProfileService.options()).data)


class OnboardingSampleView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tmdb"  # may cache TMDB's most voted movies the first time

    def get(self, request: Request) -> Response:
        params = OnboardingSampleQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        movies = TasteProfileService.onboarding_sample(
            request.user,
            preferred_genre_ids=params.validated_data["genres"],
            disliked_genre_ids=params.validated_data["avoid"],
        )
        return Response({"results": MovieSummarySerializer(movies, many=True).data})
