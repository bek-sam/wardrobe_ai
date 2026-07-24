import { OCCASION_CATEGORY_CONFIDENT_THRESHOLD } from "@/lib/recommendation";
import { createAdminClient } from "@/lib/supabase/admin";

import { RETRIEVAL_POOL_LIMIT } from "./constants.data";
import { fetchResolvedItemsById } from "./fetch-resolved-items";
import type { RetrievedOutfitCandidateItem, RetrieveStoredOutfitInput } from "./types";

export async function fetchCandidatePool(input: RetrieveStoredOutfitInput) {
  const admin = createAdminClient();
  const { data: state } = await admin
    .from("wardrobe_compilation_state")
    .select("dirty_since, compiled_wardrobe_version")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!state || state.dirty_since || !state.compiled_wardrobe_version) return null;

  let query = admin
    .from("outfit_candidates")
    .select(
      "id, times_suggested, last_suggested_at, preference_match, curator_status, style_tags, preview_status, preview_bucket, preview_storage_path, outfit_candidate_items(item_id, role, sort_order)",
    )
    .eq("user_id", input.userId)
    .eq("status", "active")
    // Curator-rejected candidates stay in storage as an audit trail only --
    // never eligible for retrieval.
    .neq("curator_status", "rejected")
    .eq("compiled_wardrobe_version", state.compiled_wardrobe_version)
    .order("total_score", { ascending: false })
    .limit(RETRIEVAL_POOL_LIMIT);
  if (input.occasionContext.confidence >= OCCASION_CATEGORY_CONFIDENT_THRESHOLD) {
    query = query.contains("occasion_categories", [input.occasionContext.category]);
  }

  const { data: rows, error } = await query;
  if (error || !rows || rows.length === 0) return null;

  const allItemIds = [
    ...new Set(
      rows.flatMap((row) =>
        ((row.outfit_candidate_items ?? []) as RetrievedOutfitCandidateItem[]).map(
          (entry) => entry.item_id,
        ),
      ),
    ),
  ];
  if (allItemIds.length === 0) return null;

  const itemsById = await fetchResolvedItemsById(admin, input.userId, allItemIds);
  if (!itemsById) return null;

  return { rows, itemsById };
}
