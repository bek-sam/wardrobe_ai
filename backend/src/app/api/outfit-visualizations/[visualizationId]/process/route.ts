import { NextResponse } from "next/server";

import { parseRouteParams } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ visualizationId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, { visualizationId }, supabase] = await Promise.all([
      requireViewer(),
      parseRouteParams(context.params, visualizationParamsSchema),
      createClient(),
    ]);
    const { data, error } = await supabase
      .from("outfit_visualizations")
      .select("id,status")
      .eq("id", visualizationId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "not_found", "Try-on not found.");
    return NextResponse.json({ data: { visualizationId, status: data.status } }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
