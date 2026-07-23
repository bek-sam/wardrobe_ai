import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { candidateAssets } from "./candidate-assets";
import { executePromotions } from "./execute-promotions";
import { loadConfirmedAssets } from "./load-confirmed-assets";
import { planConfirmedImportAssetPromotions } from "./plan-promotions";
import { requireUuid } from "./require-uuid";
import { resolveImageRow } from "./resolve-image-row";

/**
 * Copies job-scoped candidate assets into stable item-scoped locations.
 * Candidate paths and the shared original are deliberately left untouched so
 * a failed or repeated confirmation can replay this operation safely.
 */
export async function promoteConfirmedImportAssets(input: {
  userId: string;
  jobId: string;
  itemIds: string[];
}) {
  const userId = requireUuid(input.userId, "User ID");
  const jobId = requireUuid(input.jobId, "Import job ID");
  const itemIds = input.itemIds.map((itemId) => requireUuid(itemId, "Item ID"));
  if (itemIds.length === 0 || new Set(itemIds).size !== itemIds.length) {
    throw new Error("Confirmed item IDs must be a non-empty unique list.");
  }

  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const { candidates, imageRows } = await loadConfirmedAssets(admin, userId, jobId, itemIds);

  const plans = planConfirmedImportAssetPromotions({
    userId,
    candidates: candidates.map(candidateAssets),
    buckets: {
      originals: environment.WARDROBE_ORIGINALS_BUCKET,
      items: environment.WARDROBE_ITEMS_BUCKET,
      generated: environment.WARDROBE_GENERATED_BUCKET,
    },
  });
  const plansWithRows = plans.map((plan) => ({ plan, row: resolveImageRow(plan, imageRows) }));

  const updatedImageCount = await executePromotions(admin, userId, plansWithRows);

  return { copiedAssetCount: plans.length, updatedImageCount };
}
