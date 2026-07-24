import { planCreateSchema, planListQuerySchema } from "@/app/api/_lib/schemas";
import { parseQuery } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleListPlans } from "./get-handler";
import { handleCreatePlan } from "./post-handler";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, planListQuerySchema);
    const supabase = await createClient();
    const data = await handleListPlans(supabase, viewer.id, filters);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, planCreateSchema);
    const supabase = await createClient();
    const data = await handleCreatePlan(supabase, viewer.id, input);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
