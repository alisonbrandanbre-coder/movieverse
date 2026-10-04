from rest_framework import serializers

from apps.movies.serializers import MovieSummarySerializer

from .models import InteractionType


class InteractionInputSerializer(serializers.Serializer):
    """Only the action: the user always comes from `request.user` (docs/RBAC.md)."""

    type = serializers.ChoiceField(choices=InteractionType.choices)


class MovieInteractionStateSerializer(serializers.Serializer):
    movie_id = serializers.IntegerField()
    favorite = serializers.BooleanField()
    watchlist = serializers.BooleanField()
    watched = serializers.BooleanField()
    reaction = serializers.CharField(allow_null=True)


class MyMoviesQuerySerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, default=1)


class SavedMovieSerializer(MovieSummarySerializer):
    added_at = serializers.DateTimeField(read_only=True)

    class Meta(MovieSummarySerializer.Meta):
        fields = [*MovieSummarySerializer.Meta.fields, "added_at"]
