from django.urls import path

from .views import (
    MoodMoviesView,
    MovieCreditsView,
    MovieDetailView,
    MovieDiscoverView,
    MovieSearchView,
    MovieWatchProvidersView,
    TrendingMoviesView,
    WatchProvidersView,
)

urlpatterns = [
    path("search", MovieSearchView.as_view(), name="movie-search"),
    path("discover", MovieDiscoverView.as_view(), name="movie-discover"),
    path("providers", WatchProvidersView.as_view(), name="watch-providers"),
    path("trending", TrendingMoviesView.as_view(), name="movie-trending"),
    path("mood/<slug:slug>", MoodMoviesView.as_view(), name="movie-mood"),
    path("<int:movie_id>", MovieDetailView.as_view(), name="movie-detail"),
    path("<int:movie_id>/credits", MovieCreditsView.as_view(), name="movie-credits"),
    path(
        "<int:movie_id>/providers",
        MovieWatchProvidersView.as_view(),
        name="movie-watch-providers",
    ),
]
