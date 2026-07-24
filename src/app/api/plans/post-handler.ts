import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import type { planCreateSchema } from "@/app/api/_lib/schemas";

type PlanCreateInput = z.infer<typeof planCreateSchema>;

export async function handleCreatePlan(
  supabase: SupabaseClient,
  userId: string,
  input: PlanCreateInput,
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
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  throwDatabaseError(error, "Could not create the outfit plan.");
  return data;
}
