import { markOutfitWornSchema, outfitParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, resolveIdempotencyKey } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleMarkOutfitWorn } from "./handler";

type Context = { params: Promise<{ outfitId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const input = await parseJson(request, markOutfitWornSchema);
    const idempotencyKey = resolveIdempotencyKey(request, input.idempotency_key);
    const supabase = await createClient();

    const data = await handleMarkOutfitWorn(supabase, viewer.id, outfitId, input, idempotencyKey);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
