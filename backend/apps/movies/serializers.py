from rest_framework import serializers

from .filters import (
    COUNTRIES,
    DECADES,
    MAX_PROVIDERS,
    MIN_RATINGS,
    OTHER_COUNTRY,
    POPULARITY_BUCKETS,
    RELEVANCE,
    RUNTIME_RANGES,
    SORTS,
    MovieFilters,
)
from .models import Genre, Movie, MoviePerson, WatchProvider
from .services.images import backdrop_url, logo_url, poster_url, profile_url
from .services.movie_service import TMDB_MAX_PAGE

SEARCH_MIN_LENGTH = 2
SEARCH_MAX_LENGTH = 100


def _csv(value: str) -> list[str]:
    return list(dict.fromkeys(part.strip() for part in value.split(",") if part.strip()))


class MovieFilterQuerySerializer(serializers.Serializer):
    """Buscar / Descubrir filters, e.g.
    `?genres=1,2&decade=1990&rating=7&runtime=long&providers=8,337&countries=AR,OTHER
    &popularity=hidden&sort=rating&hide_watched=true`.

    `genres` are local genre ids (all of them must match); `providers` TMDB provider ids and
    `countries` ISO codes (any of them). `validated_data["filters"]` is a `MovieFilters` and
    `validated_data["hide_watched"]` a bool (it depends on the user, not on TMDB).
    """

    genres = serializers.CharField(required=False, allow_blank=True, default="")
    decade = serializers.ChoiceField(choices=DECADES, required=False, allow_null=True)
    rating = serializers.ChoiceField(choices=MIN_RATINGS, required=False, allow_null=True)
    runtime = serializers.ChoiceField(choices=list(RUNTIME_RANGES), required=False)
    providers = serializers.CharField(required=False, allow_blank=True, default="")
    countries = serializers.CharField(required=False, allow_blank=True, default="")
    popularity = serializers.ChoiceField(choices=list(POPULARITY_BUCKETS), required=False)
    sort = serializers.ChoiceField(choices=list(SORTS), required=False, default=RELEVANCE)
    hide_watched = serializers.BooleanField(required=False, default=False)
    page = serializers.IntegerField(min_value=1, max_value=TMDB_MAX_PAGE, default=1)

    def validate_genres(self, value: str) -> tuple[int, ...]:
        try:
            ids = [int(part) for part in _csv(value)]
        except ValueError as exc:
            raise serializers.ValidationError("Usá ids numéricos separados por coma.") from exc
        genres = Genre.objects.in_bulk(ids)
        if len(genres) != len(ids):
            raise serializers.ValidationError("Alguno de los géneros no existe.")
        return tuple(genres[i].tmdb_id for i in ids)

    def validate_providers(self, value: str) -> tuple[int, ...]:
        parts = _csv(value)
        if not all(part.isdigit() and int(part) > 0 for part in parts):
            raise serializers.ValidationError("Usá ids numéricos separados por coma.")
        if len(parts) > MAX_PROVIDERS:
            raise serializers.ValidationError(f"Elegí hasta {MAX_PROVIDERS} plataformas.")
        return tuple(int(part) for part in parts)

    def validate_countries(self, value: str) -> tuple[str, ...]:
        codes = [part.upper() for part in _csv(value)]
        valid = {*COUNTRIES, OTHER_COUNTRY}
        if any(code not in valid for code in codes):
            raise serializers.ValidationError("Alguno de los países no está disponible.")
        return tuple(dict.fromkeys(codes))

    def validate(self, attrs: dict) -> dict:
        attrs["filters"] = MovieFilters(
            genre_tmdb_ids=attrs.pop("genres", ()),
            decade=_int_or_none(attrs.pop("decade", None)),
            min_rating=_int_or_none(attrs.pop("rating", None)),
            runtime=attrs.pop("runtime", None),
            provider_ids=attrs.pop("providers", ()),
            countries=attrs.pop("countries", ()),
            popularity=attrs.pop("popularity", None),
            sort=attrs.pop("sort", RELEVANCE),
        )
        return attrs


def _int_or_none(value) -> int | None:
    return None if value in (None, "") else int(value)


class WatchProviderSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = WatchProvider
        fields = ["tmdb_id", "name", "logo_url"]

    def get_logo_url(self, provider: WatchProvider) -> str | None:
        return logo_url(provider.logo_path)


class MovieWatchProviderSerializer(serializers.Serializer):
    """One platform of a movie's "Dónde verla" (stored as a dict in `Movie.watch_providers`)."""

    tmdb_id = serializers.IntegerField()
    name = serializers.CharField()
    logo_url = serializers.SerializerMethodField()

    def get_logo_url(self, provider: dict) -> str | None:
        return logo_url(provider.get("logo_path"))


class MovieSearchQuerySerializer(MovieFilterQuerySerializer):
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
