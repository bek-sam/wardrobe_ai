import { NextResponse } from "next/server";

import { outfitCandidateParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ candidateId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ candidateId }, viewer, supabase] = await Promise.all([
      parseRouteParams(context.params, outfitCandidateParamsSchema),
      requireViewer(),
      createClient(),
    ]);
    const { data, error } = await supabase
      .from("outfit_candidates")
      .select("preview_status")
      .eq("id", candidateId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(error, "Could not load the outfit candidate.");
    if (!data) throwNotFound("Outfit candidate");
    return NextResponse.json({ data: { status: data.preview_status } }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
