import { ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/response";

async function handleGetCompilationStatus(supabase: SupabaseClient, userId: string) {
  const [{ data: state, error: stateError }, { data: latestJob, error: jobError }] =
    await Promise.all([
      supabase
        .from("wardrobe_compilation_state")
        .select("dirty_since, last_compiled_at, candidate_count, compiled_wardrobe_version")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("wardrobe_compilation_jobs")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (stateError) throw stateError;
  if (jobError) throw jobError;

  return {
    dirty_since: state?.dirty_since ?? null,
    last_compiled_at: state?.last_compiled_at ?? null,
    candidate_count: state?.candidate_count ?? 0,
    compiled_wardrobe_version: state?.compiled_wardrobe_version ?? null,
    latest_job_status: latestJob?.status ?? null,
  };
}

async function requestRecompilation(
  supabase: SupabaseClient,
): Promise<"up_to_date" | "already_running" | null> {
  const { data: requested, error } = await supabase.rpc("request_wardrobe_recompilation");
  if (error?.code === "PT429") {
    throw new ApiError(
      429,
      "recompile_rate_limited",
      "Too many recompile requests. Try again in a few minutes.",
    );
  }
  if (error) throw error;

  const status =
    requested && typeof requested === "object" && "status" in requested ? requested.status : null;
  if (status === "up_to_date") return "up_to_date";
  if (status === "already_running") return "already_running";
  return null;
}

export const runtime = "nodejs";

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
    await requireViewer();
    const supabase = await createClient();

    const requestedStatus = await requestRecompilation(supabase);
    if (requestedStatus === "up_to_date") return ok({ status: "up_to_date" as const });

    if (requestedStatus === "already_running") {
      return ok({ status: "running" as const }, { status: 202 });
    }

    return ok({ status: "queued" as const }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
