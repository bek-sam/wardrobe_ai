import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import type { planUpdateSchema } from "@/app/api/_lib/schemas";

type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

export async function handleUpdatePlan(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  input: PlanUpdateInput,
) {
  if (input.outfit_id) {
    const { data: outfit, error: outfitError } = await supabase
      .from("outfits")
      .select("id")
      .eq("id", input.outfit_id)
      .eq("user_id", userId)
      .maybeSingle();
    throwDatabaseError(outfitError, "Could not verify the outfit.");
    if (!outfit) throwNotFound("Outfit");
  }

  const { data, error } = await supabase
    .from("outfit_plans")
    .update(input)
    .eq("id", planId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  throwDatabaseError(error, "Could not update the outfit plan.");
  if (!data) throwNotFound("Outfit plan");
  return data;
}
