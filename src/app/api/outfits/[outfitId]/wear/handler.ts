import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { throwDatabaseError } from "@/app/api/_lib/route";
import type { markOutfitWornSchema } from "@/app/api/_lib/schemas";

import { verifyOutfitAndPlan } from "./verify-outfit-and-plan";

type MarkOutfitWornInput = z.infer<typeof markOutfitWornSchema>;

export async function handleMarkOutfitWorn(
  supabase: SupabaseClient,
  userId: string,
  outfitId: string,
  input: MarkOutfitWornInput,
  idempotencyKey: string | null,
) {
  await verifyOutfitAndPlan(supabase, userId, outfitId, input.outfit_plan_id);

  const { data: wearLogId, error } = await supabase.rpc("mark_outfit_worn", {
    p_outfit_id: outfitId,
    p_worn_at: input.worn_at ?? new Date().toISOString(),
    p_outfit_plan_id: input.outfit_plan_id ?? null,
    p_comfort_rating: input.comfort_rating ?? null,
    p_style_rating: input.style_rating ?? null,
    p_weather_rating: input.weather_rating ?? null,
    p_notes: input.notes ?? null,
    p_idempotency_key: idempotencyKey,
  });
  throwDatabaseError(error, "Could not mark the outfit as worn.");
  return { wear_log_id: wearLogId };
}
