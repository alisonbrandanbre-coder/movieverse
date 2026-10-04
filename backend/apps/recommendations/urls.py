from django.urls import path

from .views import RecommendationsView, RefreshRecommendationsView

urlpatterns = [
    path("recommendations", RecommendationsView.as_view(), name="recommendations"),
    path(
        "recommendations/refresh",
        RefreshRecommendationsView.as_view(),
        name="recommendations-refresh",
    ),
]
