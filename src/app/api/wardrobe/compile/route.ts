import { ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { claimAndRunJob } from "./claim-and-run-job";
import { handleGetCompilationStatus } from "./get-handler";
import { requestRecompilation } from "./request-recompilation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const data = await handleGetCompilationStatus(supabase, viewer.id);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const supabase = await createClient();

    const requestedStatus = await requestRecompilation(supabase);
    if (requestedStatus === "up_to_date") return ok({ status: "up_to_date" as const });
    if (requestedStatus === "already_running") {
      return ok({ status: "running" as const }, { status: 202 });
    }

    const result = await claimAndRunJob(supabase, viewer.id);
    if (!result) return ok({ status: "queued" as const }, { status: 202 });

    return ok(result, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
