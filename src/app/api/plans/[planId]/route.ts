import { planParamsSchema, planUpdateSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleDeletePlan } from "./delete-handler";
import { handleGetPlan } from "./get-handler";
import { handleUpdatePlan } from "./patch-handler";

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
