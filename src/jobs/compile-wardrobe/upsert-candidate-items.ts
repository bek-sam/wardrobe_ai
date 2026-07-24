import type { GeneratedOutfitCandidate } from "@/lib/compilation/generate-outfit-candidates";

import type { AdminClient } from "./types";

export async function upsertCandidateItems(
  admin: AdminClient,
  userId: string,
  candidates: readonly GeneratedOutfitCandidate[],
  candidateIdByCombinationKey: ReadonlyMap<string, string>,
) {
  const candidateItemRows = candidates.flatMap((candidate) => {
    const candidateId = candidateIdByCombinationKey.get(candidate.combinationKey);
    if (!candidateId) return [];
    return candidate.items.map((item) => ({
      candidate_id: candidateId,
      item_id: item.itemId,
      user_id: userId,
      role: item.role,
      sort_order: item.sortOrder,
    }));
  });
  if (candidateItemRows.length === 0) return;

  const { error } = await admin
    .from("outfit_candidate_items")
    .upsert(candidateItemRows, { onConflict: "candidate_id,item_id" });
  if (error) throw error;
}
