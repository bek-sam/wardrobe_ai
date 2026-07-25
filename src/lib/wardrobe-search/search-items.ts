import type { SupabaseClient } from "@supabase/supabase-js";

import type { ItemQuery } from "@/lib/ai/agents/orchestrator/intent";

import { rankWardrobeRows } from "./rank-rows";
import {
  WARDROBE_SEARCH_COLUMNS,
  type WardrobeSearchResult,
  type WardrobeSearchRow,
} from "./types";

const MAX_SCANNED_ROWS = 500;

/**
 * Text lookup over the caller's own active wardrobe. The client must be the
 * user-scoped one so RLS -- not this query -- is the ownership boundary.
 */
export async function searchWardrobeItems(
  supabase: SupabaseClient,
  userId: string,
  query: ItemQuery,
): Promise<WardrobeSearchResult> {
  if (query.terms.length === 0) return { matches: [], matchCount: 0, scannedCount: 0 };

  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(WARDROBE_SEARCH_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(MAX_SCANNED_ROWS);
  if (error) throw error;

  return rankWardrobeRows((data ?? []) as unknown as WardrobeSearchRow[], query);
}
