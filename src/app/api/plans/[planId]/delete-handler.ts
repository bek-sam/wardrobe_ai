import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";

export async function handleDeletePlan(supabase: SupabaseClient, userId: string, planId: string) {
  const { data, error } = await supabase
    .from("outfit_plans")
    .delete()
    .eq("id", planId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  throwDatabaseError(error, "Could not delete the outfit plan.");
  if (!data) throwNotFound("Outfit plan");
  return { deleted: true, id: planId };
}
