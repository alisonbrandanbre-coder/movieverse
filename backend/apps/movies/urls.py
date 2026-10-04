from django.urls import path

from .views import (
    MoodMoviesView,
    MovieCreditsView,
    MovieDetailView,
    MovieSearchView,
    TrendingMoviesView,
)

urlpatterns = [
    path("search", MovieSearchView.as_view(), name="movie-search"),
    path("trending", TrendingMoviesView.as_view(), name="movie-trending"),
    path("mood/<slug:slug>", MoodMoviesView.as_view(), name="movie-mood"),
    path("<int:movie_id>", MovieDetailView.as_view(), name="movie-detail"),
    path("<int:movie_id>/credits", MovieCreditsView.as_view(), name="movie-credits"),
]
