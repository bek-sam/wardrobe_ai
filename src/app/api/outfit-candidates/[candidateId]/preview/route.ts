import { outfitCandidateParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleGetPreview } from "./get-handler";
import { handleRequestPreview } from "./post-handler";

type Context = { params: Promise<{ candidateId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { candidateId } = await parseRouteParams(context.params, outfitCandidateParamsSchema);
    const supabase = await createClient();
    const data = await handleGetPreview(supabase, viewer.id, candidateId);
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const { candidateId } = await parseRouteParams(context.params, outfitCandidateParamsSchema);
    const supabase = await createClient();
    const data = await handleRequestPreview(supabase, candidateId);
    return ok(data, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
