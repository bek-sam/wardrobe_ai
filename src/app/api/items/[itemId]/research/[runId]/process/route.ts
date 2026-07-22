import { NextResponse } from "next/server";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { processResearchRun } from "@/jobs/research-item";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ itemId: string; runId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ itemId, runId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const { data: ownedRun, error: ownedRunError } = await supabase
      .from("item_research_runs")
      .select("id")
      .eq("id", runId)
      .eq("item_id", itemId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (ownedRunError) throw ownedRunError;
    if (!ownedRun) throw new ApiError(404, "research_not_found", "Research run not found.");
    const { data: claimed, error: claimError } = await supabase.rpc("claim_owned_research_run", {
      p_run_id: runId,
      p_lease_seconds: 300,
    });
    if (claimError) throw claimError;
    if (!Array.isArray(claimed) || !claimed[0]) {
      throw new ApiError(
        409,
        "research_not_claimable",
        "This research run is already processing, not ready, or has exhausted its retry budget.",
      );
    }
    if (claimed[0].item_id !== itemId) {
      throw new ApiError(404, "research_not_found", "Research run not found for this item.");
    }
    return NextResponse.json({ data: await processResearchRun(runId, viewer.id) }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
