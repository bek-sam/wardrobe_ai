import { markOutfitWornSchema, outfitParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, resolveIdempotencyKey } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { throwDatabaseError } from "@/app/api/_lib/route";
import { throwNotFound } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";

async function verifyOutfitAndPlan(
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

type MarkOutfitWornInput = z.infer<typeof markOutfitWornSchema>;

async function handleMarkOutfitWorn(
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

type Context = { params: Promise<{ outfitId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const input = await parseJson(request, markOutfitWornSchema);
    const idempotencyKey = resolveIdempotencyKey(request, input.idempotency_key);
    const supabase = await createClient();

    const data = await handleMarkOutfitWorn(supabase, viewer.id, outfitId, input, idempotencyKey);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
