import type { AdminClient, ChangeEventSummary } from "./types";

// Reads every unprocessed wardrobe_change_events row for this user (populated
// by the triggers in migration 202607220001) to decide which candidates
// actually need fresh curator attention this run, instead of treating every
// compile as "everything changed."
export async function loadChangeEvents(
  admin: AdminClient,
  userId: string,
): Promise<ChangeEventSummary> {
  const { data } = await admin
    .from("wardrobe_change_events")
    .select("id, item_id, change_type")
    .eq("user_id", userId)
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(2000);
  const rows = data ?? [];

  const createdItemIds = new Set<string>();
  const deletedItemIds = new Set<string>();
  const changedItemIds = new Set<string>();
  let hasPreferenceChange = false;

  for (const row of rows) {
    const itemId = row.item_id as string | null;
    const changeType = row.change_type as string;
    if (changeType === "preference_changed") {
      hasPreferenceChange = true;
    } else if (itemId && changeType === "created") {
      createdItemIds.add(itemId);
    } else if (itemId && changeType === "deleted") {
      deletedItemIds.add(itemId);
    } else if (
      itemId &&
      (changeType === "metadata_changed" ||
        changeType === "availability_changed" ||
        changeType === "cutout_changed")
    ) {
      changedItemIds.add(itemId);
    }
  }

  return {
    eventIds: rows.map((row) => row.id as string),
    createdItemIds,
    deletedItemIds,
    changedItemIds,
    hasPreferenceChange,
    affectedItemIds: new Set([...createdItemIds, ...changedItemIds, ...deletedItemIds]),
  };
}
