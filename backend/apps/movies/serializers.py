from rest_framework import serializers

from .models import Genre, Movie, MoviePerson
from .services.images import backdrop_url, poster_url, profile_url

SEARCH_MIN_LENGTH = 2
SEARCH_MAX_LENGTH = 100
TMDB_MAX_PAGE = 500


class MovieSearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(
        trim_whitespace=True,
        min_length=SEARCH_MIN_LENGTH,
        max_length=SEARCH_MAX_LENGTH,
        error_messages={
            "required": "Ingresá un texto para buscar.",
            "blank": "Ingresá un texto para buscar.",
            "min_length": f"La búsqueda debe tener al menos {SEARCH_MIN_LENGTH} caracteres.",
            "max_length": f"La búsqueda admite hasta {SEARCH_MAX_LENGTH} caracteres.",
        },
    )
    page = serializers.IntegerField(min_value=1, max_value=TMDB_MAX_PAGE, default=1)


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ["id", "name"]


class MovieSummarySerializer(serializers.ModelSerializer):
    release_year = serializers.IntegerField(read_only=True)
    poster_url = serializers.SerializerMethodField()

    class Meta:
        model = Movie
        fields = ["id", "tmdb_id", "title", "release_year", "poster_url", "vote_average"]

    def get_poster_url(self, movie: Movie) -> str | None:
        return poster_url(movie.poster_path)


class MovieCardSerializer(MovieSummarySerializer):
    """Summary plus what the Home hero needs (backdrop and synopsis)."""

    backdrop_url = serializers.SerializerMethodField()

    class Meta(MovieSummarySerializer.Meta):
        fields = [*MovieSummarySerializer.Meta.fields, "backdrop_url", "overview"]

    def get_backdrop_url(self, movie: Movie) -> str | None:
        return backdrop_url(movie.backdrop_path)


class MoodQuerySerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, max_value=5, default=1)


class MovieDetailSerializer(serializers.ModelSerializer):
    release_year = serializers.IntegerField(read_only=True)
    poster_url = serializers.SerializerMethodField()
    backdrop_url = serializers.SerializerMethodField()
    genres = GenreSerializer(many=True, read_only=True)

    class Meta:
        model = Movie
        fields = [
            "id",
            "tmdb_id",
            "title",
            "original_title",
            "overview",
            "release_date",
            "release_year",
            "runtime",
            "original_language",
            "poster_url",
            "backdrop_url",
            "popularity",
            "vote_average",
            "vote_count",
            "genres",
        ]

    def get_poster_url(self, movie: Movie) -> str | None:
        return poster_url(movie.poster_path)

    def get_backdrop_url(self, movie: Movie) -> str | None:
        return backdrop_url(movie.backdrop_path)


class _PersonCreditSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="person.id")
    tmdb_id = serializers.IntegerField(source="person.tmdb_id")
    name = serializers.CharField(source="person.name")
    profile_url = serializers.SerializerMethodField()

    class Meta:
        model = MoviePerson
        fields = ["id", "tmdb_id", "name", "profile_url"]

    def get_profile_url(self, credit: MoviePerson) -> str | None:
        return profile_url(credit.person.profile_path)


class DirectorSerializer(_PersonCreditSerializer):
    pass


class CastMemberSerializer(_PersonCreditSerializer):
    order = serializers.IntegerField(source="credit_order")

    class Meta(_PersonCreditSerializer.Meta):
        fields = [*_PersonCreditSerializer.Meta.fields, "character", "order"]
