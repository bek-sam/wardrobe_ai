import { NextResponse } from "next/server";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

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
    const { data, error } = await supabase.rpc("reject_research_run", { p_run_id: runId });
    if (error) throw error;
    if (!data)
      throw new ApiError(409, "research_not_rejectable", "This research run cannot be rejected.");
    return NextResponse.json({ data });
  } catch (error) {
    return routeError(error);
  }
}
