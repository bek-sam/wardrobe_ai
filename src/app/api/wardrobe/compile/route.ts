import { ApiError, ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { compileWardrobeForUser } from "@/jobs/compile-wardrobe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const [{ data: state, error: stateError }, { data: latestJob, error: jobError }] =
      await Promise.all([
        supabase
          .from("wardrobe_compilation_state")
          .select("dirty_since, last_compiled_at, candidate_count, compiled_wardrobe_version")
          .eq("user_id", viewer.id)
          .maybeSingle(),
        supabase
          .from("wardrobe_compilation_jobs")
          .select("status")
          .eq("user_id", viewer.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (stateError) throw stateError;
    if (jobError) throw jobError;
    return ok({
      dirty_since: state?.dirty_since ?? null,
      last_compiled_at: state?.last_compiled_at ?? null,
      candidate_count: state?.candidate_count ?? 0,
      compiled_wardrobe_version: state?.compiled_wardrobe_version ?? null,
      latest_job_status: latestJob?.status ?? null,
    });
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

    const { data: requested, error: requestError } = await supabase.rpc(
      "request_wardrobe_recompilation",
    );
    if (requestError?.code === "PT429") {
      throw new ApiError(
        429,
        "recompile_rate_limited",
        "Too many recompile requests. Try again in a few minutes.",
      );
    }
    if (requestError) throw requestError;
    const requestedStatus =
      requested && typeof requested === "object" && "status" in requested ? requested.status : null;

    if (requestedStatus === "up_to_date") {
      return ok({ status: "up_to_date" as const });
    }
    if (requestedStatus === "already_running") {
      return ok({ status: "running" as const }, { status: 202 });
    }

    // A new job was just queued: try to process it immediately for low
    // latency. If it's claimed by a concurrent worker first, that's fine —
    // it stays queued and a worker will still pick it up.
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_next_own_wardrobe_compilation_job",
      { p_lease_seconds: 300 },
    );
    if (claimError) throw claimError;
    const claimedJob = Array.isArray(claimed) ? claimed[0] : claimed;
    const jobId =
      claimedJob && typeof claimedJob === "object" && "id" in claimedJob ? claimedJob.id : null;
    if (typeof jobId !== "string") {
      return ok({ status: "queued" as const }, { status: 202 });
    }

    const result = await compileWardrobeForUser(viewer.id, jobId);
    return ok(result, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
