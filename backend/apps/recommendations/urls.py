from django.urls import path

from .views import RecommendationsView, RefreshRecommendationsView, SurpriseView

urlpatterns = [
    path("recommendations", RecommendationsView.as_view(), name="recommendations"),
    path(
        "recommendations/refresh",
        RefreshRecommendationsView.as_view(),
        name="recommendations-refresh",
    ),
    path("recommendations/surprise", SurpriseView.as_view(), name="recommendations-surprise"),
]
