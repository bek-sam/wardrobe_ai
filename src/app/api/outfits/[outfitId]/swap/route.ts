import { outfitParamsSchema, swapOutfitItemSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleSwapOutfitItem } from "./handler";

type Context = { params: Promise<{ outfitId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const input = await parseJson(request, swapOutfitItemSchema);
    const supabase = await createClient();

    const data = await handleSwapOutfitItem(
      supabase,
      viewer.id,
      outfitId,
      input.remove_item_id,
      input.replacement_item_id,
    );
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
