import { saveGeneratedPlanRequestSchema } from "@/features/planner/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleSaveGeneratedPlan } from "./handler";

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, saveGeneratedPlanRequestSchema),
      createClient(),
    ]);

    const data = await handleSaveGeneratedPlan(supabase, viewer.id, input.generationId);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
