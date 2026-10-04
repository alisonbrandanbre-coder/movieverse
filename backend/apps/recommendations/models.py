"""Persisted recommendations (docs/DATA_MODEL.md → RecommendationSnapshot).

A `RecommendationRun` is the last generation for a user: when it was made, from which
taste (`signature`) and whether it is the onboarding fallback or ran with TMDB degraded.
Its `RecommendationSnapshot` rows are the movies shown, with the full score breakdown.
Only `RecommendationService` writes these tables.
"""

from django.conf import settings
from django.db import models

from apps.movies.models import Movie


class PopularityBucket(models.TextChoices):
    VERY_POPULAR = "VERY_POPULAR", "Muy popular"
    POPULAR = "POPULAR", "Popular"
    MEDIUM = "MEDIUM", "Medio"
    HIDDEN = "HIDDEN", "Poco conocida"


class Section(models.TextChoices):
    FOR_YOU = "FOR_YOU", "Para vos"
    HIDDEN_GEMS = "HIDDEN_GEMS", "Joyas para descubrir"
    KEEP_EXPLORING = "KEEP_EXPLORING", "Continuá explorando"


class RecommendationRun(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recommendation_run"
    )
    generated_at = models.DateTimeField()
    # Hash of preferences + feedback used; a different one makes the run outdated.
    signature = models.CharField(max_length=64)
    discovery_level = models.CharField(max_length=10)
    is_fallback = models.BooleanField(default=False)  # onboarding incomplete
    degraded = models.BooleanField(default=False)  # some TMDB sources failed

    def __str__(self) -> str:
        return f"Recomendaciones de {self.user} ({self.generated_at:%Y-%m-%d %H:%M})"


class RecommendationSnapshot(models.Model):
    run = models.ForeignKey(RecommendationRun, on_delete=models.CASCADE, related_name="items")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recommendations"
    )
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name="+")
    section = models.CharField(max_length=16, choices=Section.choices)
    position = models.PositiveSmallIntegerField()
    affinity_score = models.FloatField()
    novelty_score = models.FloatField()
    quality_score = models.FloatField()
    diversity_score = models.FloatField()
    exploration_score = models.FloatField()
    popularity_penalty = models.FloatField()
    final_score = models.FloatField()
    popularity_bucket = models.CharField(max_length=12, choices=PopularityBucket.choices)
    explanation = models.TextField()
    generated_at = models.DateTimeField()

    class Meta:
        ordering = ["section", "position"]
        constraints = [
            # A movie is shown once per user, in a single section.
            models.UniqueConstraint(fields=["user", "movie"], name="unique_user_recommendation"),
        ]
        indexes = [models.Index(fields=["run", "section", "position"], name="snapshot_section_idx")]

    def __str__(self) -> str:
        return f"{self.user} · {self.movie} · {self.final_score:.3f}"
