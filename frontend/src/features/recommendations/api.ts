/** Recommendations API. The frontend only displays: scores and explanations come from the backend. */
import { apiRequest } from "@/api/client";
import { toSummary, type MovieSummaryDto } from "@/features/movies/api";
import type {
  PopularityBucket,
  RecommendationSectionKey,
  Recommendations,
} from "@/types/recommendations";

interface RecommendationItemDto {
  movie: MovieSummaryDto;
  position: number;
  popularity_bucket: PopularityBucket;
  explanation: string;
}

interface RecommendationsDto {
  generated_at: string;
  is_fallback: boolean;
  degraded: boolean;
  notice: string | null;
  sections: { key: RecommendationSectionKey; items: RecommendationItemDto[] }[];
}

export const recommendationKeys = {
  all: ["recommendations"] as const,
};

function toRecommendations(dto: RecommendationsDto): Recommendations {
  return {
    generatedAt: dto.generated_at,
    isFallback: dto.is_fallback,
    degraded: dto.degraded,
    notice: dto.notice,
    sections: dto.sections.map((section) => ({
      key: section.key,
      movies: section.items.map((item) => ({
        ...toSummary(item.movie),
        explanation: item.explanation,
        popularityBucket: item.popularity_bucket,
      })),
    })),
  };
}

export async function getRecommendations(signal?: AbortSignal): Promise<Recommendations> {
  return toRecommendations(await apiRequest<RecommendationsDto>("/recommendations", { signal }));
}

export async function refreshRecommendations(): Promise<Recommendations> {
  return toRecommendations(await apiRequest<RecommendationsDto>("/recommendations/refresh", { method: "POST" }));
}
