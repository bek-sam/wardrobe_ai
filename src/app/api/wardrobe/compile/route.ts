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

    // `already_running` only means a row exists in queued/running -- it does
    // not mean the job is leased. Returning early on it left a job that was
    // queued but never claimed unreachable forever: the interactive path is the
    // only thing draining the queue in a deployment without a scheduler, and it
    // refused to touch precisely the jobs that needed draining. The claim RPC
    // is the authority on whether work is available -- it takes a job only when
    // the lease is free -- so a genuinely leased job still yields nothing here.
    const result = await claimAndRunJob(supabase, viewer.id);
    if (result) return ok(result, { status: 202 });
    if (requestedStatus === "already_running") {
      return ok({ status: "running" as const }, { status: 202 });
    }

    return ok({ status: "queued" as const }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
