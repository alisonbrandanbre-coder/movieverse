from django.urls import path

from .views import MovieCreditsView, MovieDetailView, MovieSearchView

urlpatterns = [
    path("search", MovieSearchView.as_view(), name="movie-search"),
    path("<int:movie_id>", MovieDetailView.as_view(), name="movie-detail"),
    path("<int:movie_id>/credits", MovieCreditsView.as_view(), name="movie-credits"),
]
