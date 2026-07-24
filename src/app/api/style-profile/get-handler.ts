import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError } from "../_lib/route";

export async function handleGetStyleProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("style_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the style profile.");
  return data;
}
