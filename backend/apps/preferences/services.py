"""TasteProfileService: the only place that writes explicit preferences (docs/RULES.md)."""

from dataclasses import dataclass

from django.db import transaction

from apps.accounts.models import User
from apps.interactions.models import Interaction, InteractionType
from apps.interactions.services import InteractionService
from apps.movies.models import Genre, Movie
from apps.movies.services.movie_service import MovieService

from .constants import DECADES, DISCOVERY_LEVEL_DESCRIPTIONS, LANGUAGES
from .models import DiscoveryLevel, UserTasteProfile
from .taste import MAX_SEEDS, SEED_TYPES, Seed, Taste, genre_weights, signature

ONBOARDING_SAMPLE_SIZE = 12


@dataclass(frozen=True)
class PreferenceOptions:
    genres: list[Genre]
    decades: list[int]
    languages: list[dict[str, str]]
    discovery_levels: list[dict[str, str]]


class TasteProfileService:
    @staticmethod
    def get_profile(user: User) -> UserTasteProfile:
        """The user's profile; created empty (onboarding pending) on first access."""
        profile, _ = UserTasteProfile.objects.get_or_create(user=user)
        return UserTasteProfile.objects.prefetch_related("preferred_genres", "disliked_genres").get(
            pk=profile.pk
        )

    @classmethod
    def update(cls, user: User, preferences: dict) -> UserTasteProfile:
        """Replace the explicit preferences. `preferences` comes validated by the serializer."""
        with transaction.atomic():
            profile, _ = UserTasteProfile.objects.select_for_update().get_or_create(user=user)
            cls._apply(profile, preferences)
            profile.save()
        return cls.get_profile(user)

    @classmethod
    def complete_onboarding(
        cls, user: User, preferences: dict, ratings: list[dict]
    ) -> UserTasteProfile:
        """Save the wizard in one transaction: preferences, quick ratings and the done flag."""
        with transaction.atomic():
            profile, _ = UserTasteProfile.objects.select_for_update().get_or_create(user=user)
            cls._apply(profile, preferences)
            profile.onboarding_completed = True
            profile.save()
            for rating in ratings:
                InteractionService.add(user, rating["movie_id"], rating["reaction"])
        return cls.get_profile(user)

    @staticmethod
    def options() -> PreferenceOptions:
        MovieService().ensure_genre_catalog()
        return PreferenceOptions(
            genres=list(Genre.objects.order_by("name")),
            decades=DECADES,
            languages=[{"code": code, "name": name} for code, name in LANGUAGES.items()],
            discovery_levels=[
                {
                    "value": level.value,
                    "label": level.label,
                    "description": DISCOVERY_LEVEL_DESCRIPTIONS[level],
                }
                for level in DiscoveryLevel
            ],
        )

    @staticmethod
    def onboarding_sample(
        user: User, preferred_genre_ids: list[int], disliked_genre_ids: list[int]
    ) -> list[Movie]:
        """Well-known titles to rate quickly; skips what the user already rated."""
        already_rated = InteractionService.movie_ids(
            user, [InteractionType.LIKE, InteractionType.DISLIKE]
        )
        return MovieService().onboarding_sample(
            prefer_genre_ids=preferred_genre_ids,
            avoid_genre_ids=disliked_genre_ids,
            exclude_movie_ids=already_rated,
            limit=ONBOARDING_SAMPLE_SIZE,
        )

    @classmethod
    def taste(cls, user: User) -> Taste:
        """Explicit preferences + feedback (favorites, likes, watchlist, watched, dislikes)."""
        profile = cls.get_profile(user)
        interactions = list(
            Interaction.objects.filter(user=user)
            .select_related("movie")
            .prefetch_related("movie__genres")
            .order_by("-created_at", "-id")
        )
        preferred = {g.pk for g in profile.preferred_genres.all()}
        signals = [(i.type, [g.pk for g in i.movie.genres.all()]) for i in interactions]
        seeds: list[Seed] = []
        for interaction_type in SEED_TYPES:  # favorites first, newest first
            for i in interactions:
                known = any(s.movie.pk == i.movie_id for s in seeds)
                if i.type == interaction_type and not known and len(seeds) < MAX_SEEDS:
                    seeds.append(Seed(movie=i.movie, type=i.type))
        return Taste(
            onboarding_completed=profile.onboarding_completed,
            discovery_level=profile.discovery_level,
            preferred_genre_ids=frozenset(preferred),
            disliked_genre_ids=frozenset(g.pk for g in profile.disliked_genres.all()),
            decades=frozenset(profile.preferred_decades),
            languages=frozenset(profile.preferred_languages),
            genre_weights=genre_weights(preferred, signals),
            seeds=seeds,
            excluded_movie_ids=frozenset(i.movie_id for i in interactions),
            signature=signature(
                profile.updated_at.isoformat(),
                profile.onboarding_completed,
                sorted((i.movie_id, i.type) for i in interactions),
            ),
        )

    @staticmethod
    def _apply(profile: UserTasteProfile, preferences: dict) -> None:
        profile.preferred_decades = preferences["preferred_decades"]
        profile.preferred_languages = preferences["preferred_languages"]
        profile.discovery_level = preferences["discovery_level"]
        profile.preferred_genres.set(preferences["preferred_genres"])
        profile.disliked_genres.set(preferences["disliked_genres"])
