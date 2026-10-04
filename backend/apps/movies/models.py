"""Local catalog. PostgreSQL acts as the TMDB cache (no Redis in the MVP).

Genre / Person / MoviePerson are stored explicitly because the future GraphService
detects "same director", "same actor" and "shared genres" from these tables, and the
RecommendationService scores with popularity / votes / genres / language / release_date.
"""

from django.db import models


class Genre(models.Model):
    tmdb_id = models.PositiveIntegerField(unique=True)
    name = models.CharField(max_length=100)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Person(models.Model):
    tmdb_id = models.PositiveIntegerField(unique=True)
    name = models.CharField(max_length=255)
    profile_path = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "people"

    def __str__(self) -> str:
        return self.name


class Movie(models.Model):
    tmdb_id = models.PositiveIntegerField(unique=True)
    title = models.CharField(max_length=255)
    original_title = models.CharField(max_length=255, blank=True)
    overview = models.TextField(blank=True)
    release_date = models.DateField(null=True, blank=True)
    runtime = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Minutos")
    original_language = models.CharField(max_length=12, blank=True)
    poster_path = models.CharField(max_length=255, blank=True)
    backdrop_path = models.CharField(max_length=255, blank=True)
    popularity = models.FloatField(default=0)
    vote_average = models.FloatField(default=0)
    vote_count = models.PositiveIntegerField(default=0)

    genres = models.ManyToManyField(Genre, related_name="movies", blank=True)
    people = models.ManyToManyField(Person, through="MoviePerson", related_name="movies")

    # Cache bookkeeping: null means "only summary data from a search result".
    metadata_synced_at = models.DateTimeField(null=True, blank=True)
    credits_synced_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-popularity", "id"]
        indexes = [
            models.Index(fields=["popularity"], name="movie_popularity_idx"),
            models.Index(fields=["release_date"], name="movie_release_date_idx"),
            models.Index(fields=["original_language"], name="movie_language_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.release_year or 's/f'})"

    @property
    def release_year(self) -> int | None:
        return self.release_date.year if self.release_date else None


class TMDBListCache(models.Model):
    """Result of a TMDB list call (discover query, a movie's recommendations…) as an
    ordered list of tmdb ids. The movies themselves live in `Movie`; this only avoids
    asking TMDB the same list again before `TMDB_CACHE_DAYS`."""

    key = models.CharField(max_length=255, unique=True)
    tmdb_ids = models.JSONField(default=list)
    fetched_at = models.DateTimeField()

    def __str__(self) -> str:
        return f"{self.key} ({len(self.tmdb_ids)})"


class MoviePerson(models.Model):
    class RoleType(models.TextChoices):
        ACTOR = "ACTOR", "Actor"
        DIRECTOR = "DIRECTOR", "Director"

    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name="credits")
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="credits")
    role_type = models.CharField(max_length=10, choices=RoleType.choices)
    character = models.CharField(max_length=255, blank=True)
    credit_order = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["role_type", "credit_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["movie", "person", "role_type"], name="unique_movie_person_role"
            ),
        ]
        indexes = [
            # "Other movies of this person in this role" — the graph's main lookup.
            models.Index(fields=["person", "role_type"], name="movieperson_person_role_idx"),
            models.Index(
                fields=["movie", "role_type", "credit_order"], name="movieperson_movie_role_idx"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.person} — {self.get_role_type_display()} en {self.movie}"
