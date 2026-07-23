import { downloadPrivateObject, uploadPrivateObject } from "@/lib/storage/private-images";
import type { createAdminClient } from "@/lib/supabase/admin";

import type { ImportAssetPromotionPlan } from "./types";

export async function copyPlan(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  plan: ImportAssetPromotionPlan,
) {
  const bytes = await downloadPrivateObject(admin, plan.source.bucket, plan.source.path, userId);
  await uploadPrivateObject(
    admin,
    plan.destination.bucket,
    plan.destination.path,
    userId,
    bytes,
    plan.contentType,
  );
}
