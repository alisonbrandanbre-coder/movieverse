"""User ↔ movie interactions (docs/DATA_MODEL.md → Interaction).

Each row is the *current state* of one flag for one user and movie: a movie is either in
the watchlist or not, so (user, movie, type) is unique and adding twice never duplicates.
`REMOVE_WATCHLIST` is an action accepted by the API that deletes the WATCHLIST row; it is
never stored. Only `InteractionService` writes these rows.
"""

from django.conf import settings
from django.db import models

from apps.movies.models import Movie


class InteractionType(models.TextChoices):
    LIKE = "LIKE", "Me gusta"
    DISLIKE = "DISLIKE", "No me interesa"
    WATCHED = "WATCHED", "Vista"
    FAVORITE = "FAVORITE", "Favorita"
    WATCHLIST = "WATCHLIST", "Pendiente"
    REMOVE_WATCHLIST = "REMOVE_WATCHLIST", "Quitar de pendientes"


class Interaction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="interactions"
    )
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name="interactions")
    type = models.CharField(max_length=16, choices=InteractionType.choices)
    # Reserved for a future explicit score; the MVP stores LIKE/DISLIKE instead.
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "movie", "type"], name="unique_user_movie_interaction"
            ),
        ]
        indexes = [
            # Profile lists: "my favorites, newest first".
            models.Index(fields=["user", "type", "-created_at"], name="interaction_user_type_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user} · {self.get_type_display()} · {self.movie}"
