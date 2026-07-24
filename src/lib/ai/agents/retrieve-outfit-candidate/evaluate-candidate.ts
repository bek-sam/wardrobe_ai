import type { WardrobeItem } from "@/features/wardrobe/types";
import { getHardFilterReasons, outfitCombinationKey } from "@/lib/recommendation";

import { scoreCandidateRow } from "./score-candidate";
import type {
  EvaluatedCandidate,
  RetrievedOutfitCandidateItem,
  RetrieveStoredOutfitInput,
} from "./types";

export function evaluateCandidateRow(
  row: Record<string, unknown>,
  itemsById: Map<string, WardrobeItem>,
  input: RetrieveStoredOutfitInput,
): EvaluatedCandidate | null {
  const memberRows = (row.outfit_candidate_items ?? []) as RetrievedOutfitCandidateItem[];
  if (memberRows.length === 0) return null;

  const resolvedItems: WardrobeItem[] = [];
  for (const member of memberRows) {
    const item = itemsById.get(member.item_id);
    if (!item) return null;
    resolvedItems.push(item);
  }

  const hasHardConflict = resolvedItems.some(
    (item) =>
      getHardFilterReasons(item, {
        weather: input.weather,
        requiredOccasionTags: input.occasion ? [input.occasion] : undefined,
      }).length > 0,
  );
  if (hasHardConflict) return null;

  return {
    candidateId: row.id as string,
    score: scoreCandidateRow(row, resolvedItems, input),
    preferenceMatch: (row.preference_match as number | null) ?? 0,
    timesSuggested: (row.times_suggested as number | null) ?? 0,
    items: memberRows,
    resolvedItems,
    combinationKey: outfitCombinationKey(memberRows.map((member) => member.item_id)),
    curatorPreferred: row.curator_status === "selected",
    styleTags: (row.style_tags as string[] | null) ?? [],
    previewBucket: (row.preview_bucket as string | null) ?? null,
    previewStoragePath: (row.preview_storage_path as string | null) ?? null,
    previewStatus: (row.preview_status as EvaluatedCandidate["previewStatus"]) ?? "none",
  };
}
