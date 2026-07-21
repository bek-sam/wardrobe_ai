import { NextResponse } from "next/server";
import { acceptResearchSchema } from "@/features/research/schemas";
import { ApiError, parseJson, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ itemId: string; runId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const [{ itemId, runId }, viewer, input, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      parseJson(request, acceptResearchSchema),
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
    const { data, error } = await supabase.rpc("accept_research_run", {
      p_run_id: runId,
      p_fields: input.fields,
    });
    if (error) throw error;
    if (!data)
      throw new ApiError(409, "research_not_acceptable", "This research run cannot be accepted.");
    return NextResponse.json({ data: { item: data } });
  } catch (error) {
    return routeError(error);
  }
}
