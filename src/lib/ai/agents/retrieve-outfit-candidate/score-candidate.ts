import type { WardrobeItem } from "@/features/wardrobe/types";
import { scoreWardrobeCandidate } from "@/lib/recommendation";

import { RECENT_SUGGESTION_WINDOW_MS } from "./constants.data";
import type { RetrieveStoredOutfitInput } from "./types";

export function scoreCandidateRow(
  row: Record<string, unknown>,
  resolvedItems: readonly WardrobeItem[],
  input: RetrieveStoredOutfitInput,
): number {
  const perItemScores = resolvedItems.map(
    (item) =>
      scoreWardrobeCandidate(item, {
        weather: input.weather,
        occasionTags: input.occasion ? [input.occasion] : undefined,
        targetFormality: input.targetFormality,
        preferences: input.preferences,
        selectedItems: resolvedItems.filter((candidate) => candidate.id !== item.id),
      }).total,
  );
  const liveScore = perItemScores.reduce((sum, value) => sum + value, 0) / perItemScores.length;

  const timesSuggested = (row.times_suggested as number | null) ?? 0;
  const lastSuggestedAt = row.last_suggested_at
    ? new Date(row.last_suggested_at as string).getTime()
    : null;
  const recentlySuggested =
    lastSuggestedAt !== null && Date.now() - lastSuggestedAt < RECENT_SUGGESTION_WINDOW_MS;
  const exposurePenalty = Math.min(0.3, timesSuggested * 0.05) + (recentlySuggested ? 0.2 : 0);
  return Math.max(0, Math.min(1, liveScore - exposurePenalty));
}
