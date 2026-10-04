from django.contrib import admin

from .models import RecommendationRun, RecommendationSnapshot


class SnapshotInline(admin.TabularInline):
    model = RecommendationSnapshot
    extra = 0
    fields = ["section", "position", "movie", "final_score", "popularity_bucket", "explanation"]
    readonly_fields = fields
    can_delete = False


@admin.register(RecommendationRun)
class RecommendationRunAdmin(admin.ModelAdmin):
    list_display = ["user", "generated_at", "discovery_level", "is_fallback", "degraded"]
    list_filter = ["discovery_level", "is_fallback", "degraded"]
    search_fields = ["user__email"]
    inlines = [SnapshotInline]
