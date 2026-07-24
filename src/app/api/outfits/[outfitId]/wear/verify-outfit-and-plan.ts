import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";

export async function verifyOutfitAndPlan(
  supabase: SupabaseClient,
  userId: string,
  outfitId: string,
  outfitPlanId: string | null | undefined,
) {
  const { data: outfit, error: outfitError } = await supabase
    .from("outfits")
    .select("id")
    .eq("id", outfitId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(outfitError, "Could not verify the outfit.");
  if (!outfit) throwNotFound("Outfit");

  if (!outfitPlanId) return;

  const { data: plan, error: planError } = await supabase
    .from("outfit_plans")
    .select("id, outfit_id")
    .eq("id", outfitPlanId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(planError, "Could not verify the outfit plan.");
  if (!plan) throwNotFound("Outfit plan");
  if (plan.outfit_id && plan.outfit_id !== outfitId) {
    throw new ApiError(422, "plan_outfit_mismatch", "The selected plan belongs to another outfit.");
  }
}
