import type { AdminClient } from "./types";

// Enforces WARDROBE_CURATOR_MAX_SELECTED_PER_NEW_ITEM: beyond the cap, the
// lowest-ranked extras are downgraded back to 'not_reviewed' -- never
// 'rejected', since they weren't judged awkward, just not chosen this round.
export async function enforceMaxSelectedPerNewItem(
  admin: AdminClient,
  userId: string,
  createdItemIds: ReadonlySet<string>,
  maxSelectedPerNewItem: number,
) {
  for (const itemId of createdItemIds) {
    const { data: memberRows } = await admin
      .from("outfit_candidate_items")
      .select("candidate_id")
      .eq("user_id", userId)
      .eq("item_id", itemId);
    const candidateIds = [...new Set((memberRows ?? []).map((row) => row.candidate_id as string))];
    if (candidateIds.length === 0) continue;

    const { data: selectedRows } = await admin
      .from("outfit_candidates")
      .select("id, curator_rank")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("curator_status", "selected")
      .in("id", candidateIds);
    const rows = selectedRows ?? [];
    if (rows.length <= maxSelectedPerNewItem) continue;

    const sorted = [...rows].sort(
      (first, second) =>
        ((first.curator_rank as number | null) ?? 999) -
        ((second.curator_rank as number | null) ?? 999),
    );
    const excess = sorted.slice(maxSelectedPerNewItem);
    await Promise.all(
      excess.map((row) =>
        admin
          .from("outfit_candidates")
          .update({ curator_status: "not_reviewed", curator_rank: null })
          .eq("id", row.id as string)
          .eq("user_id", userId),
      ),
    );
  }
}
