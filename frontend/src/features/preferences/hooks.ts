import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { recommendationKeys } from "@/features/recommendations/api";
import type { PreferencesDraft, QuickRating } from "@/types/preferences";

import {
  completeOnboarding,
  getOnboardingSample,
  getPreferenceOptions,
  getPreferences,
  preferencesKeys,
  updatePreferences,
} from "./api";

export function usePreferences() {
  return useQuery({
    queryKey: preferencesKeys.current,
    queryFn: ({ signal }) => getPreferences(signal),
    staleTime: 5 * 60_000,
  });
}

export function usePreferenceOptions() {
  return useQuery({
    queryKey: preferencesKeys.options,
    queryFn: ({ signal }) => getPreferenceOptions(signal),
    staleTime: 60 * 60_000,
  });
}

export function useOnboardingSample(genreIds: number[], avoidIds: number[], enabled: boolean) {
  return useQuery({
    queryKey: preferencesKeys.sample(genreIds, avoidIds),
    queryFn: ({ signal }) => getOnboardingSample(genreIds, avoidIds, signal),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData(preferencesKeys.current, preferences);
      void queryClient.invalidateQueries({ queryKey: recommendationKeys.all });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, ratings }: { draft: PreferencesDraft; ratings: QuickRating[] }) =>
      completeOnboarding(draft, ratings),
    onSuccess: (preferences) => {
      queryClient.setQueryData(preferencesKeys.current, preferences);
      // Quick ratings are stored as LIKE/DISLIKE interactions.
      void queryClient.invalidateQueries({ queryKey: ["interactions"] });
      void queryClient.invalidateQueries({ queryKey: recommendationKeys.all });
    },
  });
}
