import type { WardrobeItemRole } from "@/features/wardrobe/types";
import { outfitCombinationKey, resolveOccasionContext } from "@/lib/recommendation";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RecordFallbackOutfitCandidateInput {
  userId: string;
  occasion?: string | null;
  items: readonly { item_id: string; role: WardrobeItemRole; sort_order?: number }[];
}

/**
 * Opportunistically grows the library with an outfit the LLM had to compose
 * from scratch because nothing stored fit the request. The insert is now one
 * atomic RPC call (record_fallback_outfit_candidate) instead of two separate,
 * non-transactional inserts, so a failure can never leave an active candidate
 * with zero items. Best-effort: failures are swallowed so they can never
 * affect the user-facing response.
 */
export async function recordFallbackOutfitCandidate(input: RecordFallbackOutfitCandidateInput) {
  try {
    const admin = createAdminClient();
    const occasionContext = resolveOccasionContext(input.occasion);
    const combinationKey = outfitCombinationKey(input.items.map((item) => item.item_id));
    await admin.rpc("record_fallback_outfit_candidate", {
      p_user_id: input.userId,
      p_combination_key: combinationKey,
      p_occasion_category: occasionContext.category,
      p_occasion_tags: input.occasion ? [input.occasion] : [],
      p_items: input.items.map((item, index) => ({
        item_id: item.item_id,
        role: item.role,
        sort_order: item.sort_order ?? index,
      })),
    });
  } catch {
    // Never let library growth affect the user-facing generation response.
  }
}
