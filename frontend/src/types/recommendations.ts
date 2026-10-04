import type { MovieSummary } from "./movie";

export type PopularityBucket = "VERY_POPULAR" | "POPULAR" | "MEDIUM" | "HIDDEN";
export type RecommendationSectionKey = "FOR_YOU" | "HIDDEN_GEMS" | "KEEP_EXPLORING";

/** A movie as recommended by the API. Ranking and explanation come from the backend. */
export interface RecommendedMovie extends MovieSummary {
  explanation: string;
  popularityBucket: PopularityBucket;
}

export interface RecommendationSection {
  key: RecommendationSectionKey;
  movies: RecommendedMovie[];
}

export interface Recommendations {
  generatedAt: string;
  isFallback: boolean;
  degraded: boolean;
  /** Message to show as is (fallback or degraded), or null. */
  notice: string | null;
  sections: RecommendationSection[];
}

/** Surprise mode's pick (EPIC 4): drawn by the backend among the user's best recommendations. */
export type Surprise = RecommendedMovie;
