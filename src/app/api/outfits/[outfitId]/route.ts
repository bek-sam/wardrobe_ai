import { outfitParamsSchema, outfitUpdateSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleDeleteOutfit } from "./delete-handler";
import { handleGetOutfit } from "./get-handler";
import { handleUpdateOutfit } from "./patch-handler";

type Context = { params: Promise<{ outfitId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const supabase = await createClient();
    const data = await handleGetOutfit(supabase, viewer.id, outfitId);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const input = await parseJson(request, outfitUpdateSchema);
    const supabase = await createClient();
    const data = await handleUpdateOutfit(supabase, viewer.id, outfitId, input);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const supabase = await createClient();
    const data = await handleDeleteOutfit(supabase, viewer.id, outfitId);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
