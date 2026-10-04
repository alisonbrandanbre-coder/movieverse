from django.urls import path

from .views import MovieGraphView

urlpatterns = [
    path("graph/movies/<int:movie_id>", MovieGraphView.as_view(), name="graph-movie"),
]
