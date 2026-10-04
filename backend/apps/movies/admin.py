from django.contrib import admin

from .models import Genre, Movie, MoviePerson, Person, WatchProvider


class MoviePersonInline(admin.TabularInline):
    model = MoviePerson
    extra = 0
    autocomplete_fields = ["person"]


@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "release_date", "tmdb_id", "popularity", "vote_average"]
    search_fields = ["title", "original_title", "tmdb_id"]
    list_filter = ["genres", "original_language"]
    readonly_fields = ["created_at", "updated_at", "metadata_synced_at", "credits_synced_at"]
    filter_horizontal = ["genres"]
    inlines = [MoviePersonInline]


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "tmdb_id"]
    search_fields = ["name"]


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "tmdb_id"]
    search_fields = ["name"]


@admin.register(WatchProvider)
class WatchProviderAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "tmdb_id", "display_priority"]
    search_fields = ["name"]
