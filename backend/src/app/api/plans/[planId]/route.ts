import { planParamsSchema, planUpdateSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import type { z } from "zod";

type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

async function handleUpdatePlan(
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

async function handleDeletePlan(supabase: SupabaseClient, userId: string, planId: string) {
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

async function handleGetPlan(supabase: SupabaseClient, userId: string, planId: string) {
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

type Context = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { planId } = await parseRouteParams(context.params, planParamsSchema);
    const supabase = await createClient();
    const data = await handleGetPlan(supabase, viewer.id, planId);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { planId } = await parseRouteParams(context.params, planParamsSchema);
    const input = await parseJson(request, planUpdateSchema);
    const supabase = await createClient();
    const data = await handleUpdatePlan(supabase, viewer.id, planId, input);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { planId } = await parseRouteParams(context.params, planParamsSchema);
    const supabase = await createClient();
    const data = await handleDeletePlan(supabase, viewer.id, planId);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
