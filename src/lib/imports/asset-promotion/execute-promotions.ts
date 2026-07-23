import type { createAdminClient } from "@/lib/supabase/admin";

import { copyPlan } from "./copy-plan";
import type { ImageRow } from "./schemas";
import type { ImportAssetPromotionPlan } from "./types";
import { updateImageRow } from "./update-image-row";

export async function executePromotions(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  plansWithRows: { plan: ImportAssetPromotionPlan; row: ImageRow }[],
) {
  // Finish all copy attempts before changing any database path. Successful
  // copies may be replayed with upsert=true if another copy fails.
  const copyResults = await Promise.allSettled(
    plansWithRows.map(({ plan }) => copyPlan(admin, userId, plan)),
  );
  const copyFailure = copyResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (copyFailure) {
    throw new Error("One or more confirmed assets could not be copied.", {
      cause: copyFailure.reason,
    });
  }

  const updateResults = await Promise.allSettled(
    plansWithRows.map(({ row, plan }) => updateImageRow(admin, row, plan)),
  );
  const updateFailure = updateResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (updateFailure) {
    throw new Error("One or more confirmed image rows could not be promoted.", {
      cause: updateFailure.reason,
    });
  }

  return updateResults.filter(
    (result): result is PromiseFulfilledResult<true> =>
      result.status === "fulfilled" && result.value,
  ).length;
}
