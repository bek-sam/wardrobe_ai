import { NextResponse } from "next/server";

import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ itemId: string; runId: string }> };

/** Durable research is claimed only by Worker; this preserves the old polling command URL. */
export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ itemId, runId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const { data, error } = await supabase
      .from("item_research_runs")
      .select("id,status")
      .eq("id", runId)
      .eq("item_id", itemId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "research_not_found", "Research run not found.");
    return NextResponse.json({ data: { runId, status: data.status } }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
