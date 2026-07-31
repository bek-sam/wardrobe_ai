import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Which of these items actually have an approved cut-out. Try-on renders from
 * cut-outs, so a look containing a manually added item that never went through
 * the photo pipeline is shown with "Try it on" disabled and an explanation,
 * rather than failing after the user has already spent a quota unit.
 */
export async function loadItemIdsWithCutout(
  userId: string,
  itemIds: readonly string[],
): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();
  const { data } = await createAdminClient()
    .from("wardrobe_item_images")
    .select("item_id")
    .eq("user_id", userId)
    .eq("kind", "cutout")
    .in("item_id", [...new Set(itemIds)]);
  return new Set((data ?? []).map((row) => row.item_id as string));
}
