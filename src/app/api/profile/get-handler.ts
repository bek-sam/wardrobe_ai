import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "../_lib/route";

export async function handleGetProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the profile.");
  if (!data) throwNotFound("Profile");
  return data;
}
