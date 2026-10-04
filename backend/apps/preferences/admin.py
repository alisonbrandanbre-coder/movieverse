from django.contrib import admin

from .models import UserTasteProfile


@admin.register(UserTasteProfile)
class UserTasteProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "discovery_level", "onboarding_completed", "updated_at"]
    list_filter = ["discovery_level", "onboarding_completed"]
    search_fields = ["user__email"]
    filter_horizontal = ["preferred_genres", "disliked_genres"]
