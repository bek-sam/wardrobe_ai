import { NextResponse } from "next/server";

import { researchRequestSchema } from "@/features/research/schemas";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleGetResearchRuns } from "./get-handler";
import { handleEnqueueResearch } from "./post-handler";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const [{ itemId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const data = await handleGetResearchRuns(supabase, viewer.id, itemId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ itemId }, viewer, input, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      parseJson(request, researchRequestSchema),
      createClient(),
    ]);
    const data = await handleEnqueueResearch(supabase, viewer.id, itemId, input.userClue);
    return NextResponse.json(
      { data },
      { status: 202, headers: { Location: `/api/items/${itemId}/research/${data.id}` } },
    );
  } catch (error) {
    return routeError(error);
  }
}
