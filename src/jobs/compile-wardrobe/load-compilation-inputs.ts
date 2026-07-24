import { loadChangeEvents } from "./load-change-events";
import { loadPreferenceContext } from "./load-preference-context";
import { parseWardrobeRow } from "./parse-wardrobe-row";
import type { AdminClient } from "./types";

export async function loadCompilationInputs(admin: AdminClient, userId: string) {
  const [{ data: initialState }, { data: itemRows, error: itemsError }, preferences, changeEvents] =
    await Promise.all([
      admin
        .from("wardrobe_compilation_state")
        .select("pending_change_count, compiled_wardrobe_version, candidate_count")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("wardrobe_items")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("availability_status", "available")
        .is("deleted_at", null)
        .limit(500),
      loadPreferenceContext(admin, userId),
      loadChangeEvents(admin, userId),
    ]);
  if (itemsError) throw itemsError;

  return {
    initialState,
    startChangeCount: (initialState?.pending_change_count as number | undefined) ?? 0,
    items: (itemRows ?? []).map((row) => parseWardrobeRow(row as Record<string, unknown>)),
    preferences,
    changeEvents,
  };
}
