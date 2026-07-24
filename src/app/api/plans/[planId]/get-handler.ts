import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";

export async function handleGetPlan(supabase: SupabaseClient, userId: string, planId: string) {
  const { data, error } = await supabase
    .from("outfit_plans")
    .select("*, outfits(*, outfit_items(*, wardrobe_items(*)))")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the outfit plan.");
  if (!data) throwNotFound("Outfit plan");
  return data;
}
