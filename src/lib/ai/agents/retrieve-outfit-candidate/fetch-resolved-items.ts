import type { createAdminClient } from "@/lib/supabase/admin";

import { parseWardrobeRow } from "./parse-wardrobe-row";

export async function fetchResolvedItemsById(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  itemIds: readonly string[],
) {
  const { data: itemRows, error } = await admin
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("availability_status", "available")
    .is("deleted_at", null)
    .in("id", itemIds);
  if (error || !itemRows) return null;

  return new Map(
    itemRows.map((row) => [row.id as string, parseWardrobeRow(row as Record<string, unknown>)]),
  );
}
