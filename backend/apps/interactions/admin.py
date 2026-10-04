from django.contrib import admin

from .models import Interaction


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ["user", "movie", "type", "created_at"]
    list_filter = ["type"]
    search_fields = ["user__email", "movie__title"]
    raw_id_fields = ["user", "movie"]
