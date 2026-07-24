import { outfitCombinationKey } from "@/lib/recommendation";

import type { AdminClient, ServerEnvironment } from "./types";

export async function matchOutfitToCandidateAndEnqueue(
  admin: AdminClient,
  userId: string,
  outfitId: string,
  reason: "tomorrow_plan" | "user_saved",
  environment: ServerEnvironment,
) {
  const { data: outfitItemRows } = await admin
    .from("outfit_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("outfit_id", outfitId);
  const itemIds = (outfitItemRows ?? []).map((row) => row.item_id as string);
  if (itemIds.length === 0) return;

  const combinationKey = outfitCombinationKey(itemIds);
  const { data: candidate } = await admin
    .from("outfit_candidates")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("combination_key", combinationKey)
    .maybeSingle();
  // Scoped only to the compiled library: a fully custom outfit with no
  // matching candidate row is skipped rather than backfilling one here.
  if (!candidate) return;

  await admin.rpc("enqueue_outfit_preview_job", {
    p_user_id: userId,
    p_candidate_id: candidate.id,
    p_priority_reason: reason,
    p_max_queued_per_user: environment.PREVIEW_MAX_QUEUED_PER_USER,
  });
}
