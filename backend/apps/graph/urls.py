from django.urls import path

from .views import MovieGraphView, MovieSagaView

urlpatterns = [
    path("graph/movies/<int:movie_id>", MovieGraphView.as_view(), name="graph-movie"),
    path("graph/movies/<int:movie_id>/saga", MovieSagaView.as_view(), name="graph-movie-saga"),
]
