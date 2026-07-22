import { markOutfitWornSchema, outfitParamsSchema } from "@/app/api/_lib/schemas";
import {
  parseRouteParams,
  resolveIdempotencyKey,
  throwDatabaseError,
  throwNotFound,
} from "@/app/api/_lib/route";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

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
    const { data: outfit, error: outfitError } = await supabase
      .from("outfits")
      .select("id")
      .eq("id", outfitId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(outfitError, "Could not verify the outfit.");
    if (!outfit) throwNotFound("Outfit");

    if (input.outfit_plan_id) {
      const { data: plan, error: planError } = await supabase
        .from("outfit_plans")
        .select("id, outfit_id")
        .eq("id", input.outfit_plan_id)
        .eq("user_id", viewer.id)
        .maybeSingle();
      throwDatabaseError(planError, "Could not verify the outfit plan.");
      if (!plan) throwNotFound("Outfit plan");
      if (plan.outfit_id && plan.outfit_id !== outfitId) {
        throw new ApiError(
          422,
          "plan_outfit_mismatch",
          "The selected plan belongs to another outfit.",
        );
      }
    }

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
    return ok({ wear_log_id: wearLogId });
  } catch (error) {
    return routeError(error);
  }
}
