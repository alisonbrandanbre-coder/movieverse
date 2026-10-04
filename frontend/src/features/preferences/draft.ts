import type { PreferencesDraft } from "@/types/preferences";

export const EMPTY_DRAFT: PreferencesDraft = {
  preferredGenreIds: [],
  dislikedGenreIds: [],
  decades: [],
  languages: [],
  discoveryLevel: "BALANCED",
};

export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** A genre is either favorite or to avoid: choosing it in one list removes it from the other. */
export function togglePreferredGenre(draft: PreferencesDraft, genreId: number): PreferencesDraft {
  return {
    ...draft,
    preferredGenreIds: toggleValue(draft.preferredGenreIds, genreId),
    dislikedGenreIds: draft.dislikedGenreIds.filter((id) => id !== genreId),
  };
}

export function toggleDislikedGenre(draft: PreferencesDraft, genreId: number): PreferencesDraft {
  return {
    ...draft,
    dislikedGenreIds: toggleValue(draft.dislikedGenreIds, genreId),
    preferredGenreIds: draft.preferredGenreIds.filter((id) => id !== genreId),
  };
}
