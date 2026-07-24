import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { ApiError } from "@/lib/api/response";

import { throwDatabaseError } from "../_lib/route";
import type { styleProfileUpdateSchema } from "../_lib/schemas";

type StyleProfileUpdateInput = z.infer<typeof styleProfileUpdateSchema>;

export async function handleUpdateStyleProfile(
  supabase: SupabaseClient,
  userId: string,
  input: StyleProfileUpdateInput,
) {
  const { data: existing, error: readError } = await supabase
    .from("style_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(readError, "Could not load the style profile.");

  const runsCold = input.runs_cold === undefined ? existing?.runs_cold : input.runs_cold;
  const runsHot = input.runs_hot === undefined ? existing?.runs_hot : input.runs_hot;
  if (runsCold === true && runsHot === true) {
    throw new ApiError(422, "validation_failed", "runs_cold and runs_hot cannot both be true.");
  }

  if (existing) {
    const { data, error } = await supabase
      .from("style_profiles")
      .update(input)
      .eq("user_id", userId)
      .select()
      .single();
    throwDatabaseError(error, "Could not update the style profile.");
    return { data, status: 200 as const };
  }

  const { data, error } = await supabase
    .from("style_profiles")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  throwDatabaseError(error, "Could not create the style profile.");
  return { data, status: 201 as const };
}
