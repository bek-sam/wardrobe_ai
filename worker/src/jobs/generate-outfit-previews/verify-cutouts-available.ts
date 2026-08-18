import { MissingCutoutError, type AdminClient } from "./contracts";

// A cheap existence check run before quota is consumed, so a job that could
// never succeed (a member item has no approved cutout yet) doesn't burn a
// day's quota unit first -- loadPrimaryCutout() still re-checks per item at
// download time as a defense-in-depth guard against a cutout disappearing
// between this check and the render.
export async function verifyCutoutsAvailable(
  admin: AdminClient,
  userId: string,
  itemIds: readonly string[],
) {
  const { data } = await admin
    .from("wardrobe_item_images")
    .select("item_id")
    .eq("user_id", userId)
    .eq("kind", "cutout")
    .in("item_id", itemIds);
  const itemIdsWithCutout = new Set((data ?? []).map((row) => row.item_id as string));
  const missingItemId = itemIds.find((itemId) => !itemIdsWithCutout.has(itemId));
  if (missingItemId) throw new MissingCutoutError(missingItemId);
}
