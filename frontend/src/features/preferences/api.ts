/** Preferences API: DTOs (snake_case) and mappers to UI types. */
import { apiRequest } from "@/api/client";
import { toSummary, type MovieSummaryDto } from "@/features/movies/api";
import type { Genre, MovieSummary } from "@/types/movie";
import type {
  DiscoveryLevel,
  PreferenceOptions,
  Preferences,
  PreferencesDraft,
  QuickRating,
} from "@/types/preferences";

interface PreferencesDto {
  preferred_genres: Genre[];
  disliked_genres: Genre[];
  preferred_decades: number[];
  preferred_languages: string[];
  discovery_level: DiscoveryLevel;
  onboarding_completed: boolean;
}

interface PreferencesInputDto {
  preferred_genres: number[];
  disliked_genres: number[];
  preferred_decades: number[];
  preferred_languages: string[];
  discovery_level: DiscoveryLevel;
}

interface PreferenceOptionsDto {
  genres: Genre[];
  decades: number[];
  languages: { code: string; name: string }[];
  discovery_levels: { value: DiscoveryLevel; label: string; description: string }[];
}

export const preferencesKeys = {
  current: ["preferences"] as const,
  options: ["preferences", "options"] as const,
  sample: (genreIds: number[], avoidIds: number[]) => ["preferences", "sample", genreIds, avoidIds] as const,
};

function toPreferences(dto: PreferencesDto): Preferences {
  return {
    preferredGenres: dto.preferred_genres,
    dislikedGenres: dto.disliked_genres,
    preferredDecades: dto.preferred_decades,
    preferredLanguages: dto.preferred_languages,
    discoveryLevel: dto.discovery_level,
    onboardingCompleted: dto.onboarding_completed,
  };
}

function toInputDto(draft: PreferencesDraft): PreferencesInputDto {
  return {
    preferred_genres: draft.preferredGenreIds,
    disliked_genres: draft.dislikedGenreIds,
    preferred_decades: draft.decades,
    preferred_languages: draft.languages,
    discovery_level: draft.discoveryLevel,
  };
}

export function toDraft(preferences: Preferences): PreferencesDraft {
  return {
    preferredGenreIds: preferences.preferredGenres.map((genre) => genre.id),
    dislikedGenreIds: preferences.dislikedGenres.map((genre) => genre.id),
    decades: preferences.preferredDecades,
    languages: preferences.preferredLanguages,
    discoveryLevel: preferences.discoveryLevel,
  };
}

export async function getPreferences(signal?: AbortSignal): Promise<Preferences> {
  return toPreferences(await apiRequest<PreferencesDto>("/preferences", { signal }));
}

export async function updatePreferences(draft: PreferencesDraft): Promise<Preferences> {
  return toPreferences(await apiRequest<PreferencesDto>("/preferences", { method: "PUT", body: toInputDto(draft) }));
}

export async function completeOnboarding(draft: PreferencesDraft, ratings: QuickRating[]): Promise<Preferences> {
  const body = {
    ...toInputDto(draft),
    ratings: ratings.map(({ movieId, reaction }) => ({ movie_id: movieId, reaction })),
  };
  return toPreferences(await apiRequest<PreferencesDto>("/preferences/onboarding", { method: "POST", body }));
}

export async function getPreferenceOptions(signal?: AbortSignal): Promise<PreferenceOptions> {
  const dto = await apiRequest<PreferenceOptionsDto>("/preferences/options", { signal });
  return { genres: dto.genres, decades: dto.decades, languages: dto.languages, discoveryLevels: dto.discovery_levels };
}

export async function getOnboardingSample(
  genreIds: number[],
  avoidIds: number[],
  signal?: AbortSignal,
): Promise<MovieSummary[]> {
  const dto = await apiRequest<{ results: MovieSummaryDto[] }>("/movies/onboarding-sample", {
    params: { genres: genreIds.join(","), avoid: avoidIds.join(",") },
    signal,
  });
  return dto.results.map(toSummary);
}
