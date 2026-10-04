import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getRecommendations, recommendationKeys, refreshRecommendations } from "./api";

/**
 * The backend regenerates recommendations by itself when preferences or feedback change,
 * so after an interaction we only need to invalidate this query.
 */
export function useRecommendations() {
  return useQuery({
    queryKey: recommendationKeys.all,
    queryFn: ({ signal }) => getRecommendations(signal),
    staleTime: 5 * 60_000,
  });
}

export function useRefreshRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshRecommendations,
    onSuccess: (data) => queryClient.setQueryData(recommendationKeys.all, data),
  });
}
