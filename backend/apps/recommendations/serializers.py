from rest_framework import serializers

from apps.movies.serializers import MovieSummarySerializer

from .models import RecommendationSnapshot, Section


class RecommendationItemSerializer(serializers.ModelSerializer):
    movie = MovieSummarySerializer(read_only=True)
    scores = serializers.SerializerMethodField()

    class Meta:
        model = RecommendationSnapshot
        fields = ["movie", "position", "popularity_bucket", "explanation", "scores"]

    def get_scores(self, item: RecommendationSnapshot) -> dict[str, float]:
        """Score breakdown, rounded for transport. Computed by RecommendationService only."""
        return {
            "affinity": round(item.affinity_score, 4),
            "novelty": round(item.novelty_score, 4),
            "quality": round(item.quality_score, 4),
            "diversity": round(item.diversity_score, 4),
            "exploration": round(item.exploration_score, 4),
            "popularity_penalty": round(item.popularity_penalty, 4),
            "final": round(item.final_score, 4),
        }


def serialize_result(result) -> dict:
    run = result.run
    return {
        "generated_at": run.generated_at,
        "discovery_level": run.discovery_level,
        "is_fallback": run.is_fallback,
        "degraded": run.degraded,
        "notice": result.notice,
        "sections": [
            {
                "key": section,
                "items": RecommendationItemSerializer(result.sections[section], many=True).data,
            }
            for section in Section.values
        ],
    }
