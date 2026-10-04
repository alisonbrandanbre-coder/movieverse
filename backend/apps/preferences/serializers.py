from rest_framework import serializers

from apps.interactions.models import InteractionType
from apps.movies.models import Genre, Movie
from apps.movies.serializers import GenreSerializer

from .constants import DECADES, LANGUAGES, MAX_RATINGS
from .models import DiscoveryLevel, UserTasteProfile


def _unique(values: list) -> list:
    return list(dict.fromkeys(values))


class PreferencesSerializer(serializers.ModelSerializer):
    """Read shape: genres as {id, name} so the UI can render them without another call."""

    preferred_genres = GenreSerializer(many=True, read_only=True)
    disliked_genres = GenreSerializer(many=True, read_only=True)

    class Meta:
        model = UserTasteProfile
        fields = [
            "preferred_genres",
            "disliked_genres",
            "preferred_decades",
            "preferred_languages",
            "discovery_level",
            "onboarding_completed",
            "updated_at",
        ]
        read_only_fields = fields


class PreferencesInputSerializer(serializers.Serializer):
    """Write shape: genre ids. Shared by PUT /preferences and POST /preferences/onboarding."""

    preferred_genres = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        error_messages={"min_length": "Elegí al menos un género favorito."},
    )
    disliked_genres = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, default=list
    )
    preferred_decades = serializers.ListField(
        child=serializers.ChoiceField(choices=DECADES), required=False, default=list
    )
    preferred_languages = serializers.ListField(
        child=serializers.ChoiceField(choices=list(LANGUAGES)), required=False, default=list
    )
    discovery_level = serializers.ChoiceField(
        choices=DiscoveryLevel.choices, required=False, default=DiscoveryLevel.BALANCED
    )

    def _validate_genres(self, ids: list[int]) -> list[int]:
        ids = _unique(ids)
        missing = set(ids) - set(Genre.objects.filter(pk__in=ids).values_list("pk", flat=True))
        if missing:
            raise serializers.ValidationError(
                f"Géneros inexistentes: {', '.join(map(str, sorted(missing)))}."
            )
        return ids

    def validate_preferred_genres(self, value: list[int]) -> list[int]:
        return self._validate_genres(value)

    def validate_disliked_genres(self, value: list[int]) -> list[int]:
        return self._validate_genres(value)

    def validate_preferred_decades(self, value: list[int]) -> list[int]:
        return sorted(set(value))

    def validate_preferred_languages(self, value: list[str]) -> list[str]:
        return _unique(value)

    def validate(self, attrs: dict) -> dict:
        overlap = set(attrs["preferred_genres"]) & set(attrs["disliked_genres"])
        if overlap:
            raise serializers.ValidationError(
                {"disliked_genres": ["Un género no puede ser favorito y a evitar a la vez."]}
            )
        return attrs


class QuickRatingSerializer(serializers.Serializer):
    movie_id = serializers.IntegerField(min_value=1)
    reaction = serializers.ChoiceField(choices=[InteractionType.LIKE, InteractionType.DISLIKE])


class OnboardingInputSerializer(PreferencesInputSerializer):
    ratings = serializers.ListField(
        child=QuickRatingSerializer(), required=False, default=list, max_length=MAX_RATINGS
    )

    def validate_ratings(self, value: list[dict]) -> list[dict]:
        # The last reaction for a movie wins.
        by_movie = {rating["movie_id"]: rating for rating in value}
        existing = set(Movie.objects.filter(pk__in=by_movie).values_list("pk", flat=True))
        missing = set(by_movie) - existing
        if missing:
            raise serializers.ValidationError(
                f"Películas inexistentes: {', '.join(map(str, sorted(missing)))}."
            )
        return list(by_movie.values())


class OnboardingSampleQuerySerializer(serializers.Serializer):
    """`?genres=1,2&avoid=3`: the wizard's choices so far (not saved yet)."""

    genres = serializers.CharField(required=False, default="")
    avoid = serializers.CharField(required=False, default="")

    @staticmethod
    def _ids(value: str) -> list[int]:
        try:
            return [int(part) for part in value.split(",") if part.strip()]
        except ValueError as exc:
            raise serializers.ValidationError("Usá ids numéricos separados por coma.") from exc

    def validate_genres(self, value: str) -> list[int]:
        return self._ids(value)

    def validate_avoid(self, value: str) -> list[int]:
        return self._ids(value)


class PreferenceOptionsSerializer(serializers.Serializer):
    genres = GenreSerializer(many=True)
    decades = serializers.ListField(child=serializers.IntegerField())
    languages = serializers.ListField(child=serializers.DictField())
    discovery_levels = serializers.ListField(child=serializers.DictField())
