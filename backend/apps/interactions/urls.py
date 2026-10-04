from django.urls import path

from .models import InteractionType
from .views import MovieInteractionsView, MyMoviesView, RemoveInteractionView

urlpatterns = [
    path(
        "movies/<int:movie_id>/interactions",
        MovieInteractionsView.as_view(),
        name="movie-interactions",
    ),
    path(
        "movies/<int:movie_id>/interactions/<str:interaction_type>",
        RemoveInteractionView.as_view(),
        name="movie-interaction-remove",
    ),
    path(
        "me/favorites",
        MyMoviesView.as_view(interaction_type=InteractionType.FAVORITE),
        name="me-favorites",
    ),
    path(
        "me/watchlist",
        MyMoviesView.as_view(interaction_type=InteractionType.WATCHLIST),
        name="me-watchlist",
    ),
    path(
        "me/watched",
        MyMoviesView.as_view(interaction_type=InteractionType.WATCHED),
        name="me-watched",
    ),
    path(
        "me/likes",
        MyMoviesView.as_view(interaction_type=InteractionType.LIKE),
        name="me-likes",
    ),
]
