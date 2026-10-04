"""Explicit taste preferences captured by the onboarding (docs/DATA_MODEL.md → UserTasteProfile).

Only `TasteProfileService` writes these rows (docs/RULES.md). The recommender (Sprint 3)
reads them; implicit signals live in `apps.interactions`.
"""

from django.conf import settings
from django.db import models

from apps.movies.models import Genre


class DiscoveryLevel(models.TextChoices):
    FAMILIAR = "FAMILIAR", "Familiar"
    BALANCED = "BALANCED", "Equilibrado"
    EXPLORER = "EXPLORER", "Explorador"


class UserTasteProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="taste_profile"
    )
    preferred_genres = models.ManyToManyField(Genre, related_name="+", blank=True)
    disliked_genres = models.ManyToManyField(Genre, related_name="+", blank=True)
    # Decade start years (1990 = the 90s) and ISO 639-1 codes, validated by the service.
    preferred_decades = models.JSONField(default=list, blank=True)
    preferred_languages = models.JSONField(default=list, blank=True)
    discovery_level = models.CharField(
        max_length=10, choices=DiscoveryLevel.choices, default=DiscoveryLevel.BALANCED
    )
    onboarding_completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Preferencias de {self.user}"
