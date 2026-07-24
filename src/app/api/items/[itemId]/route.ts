import { itemParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { wardrobeItemUpdateSchema } from "@/features/wardrobe/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleDeleteItem } from "./delete-handler";
import { handleGetItem } from "./get-handler";
import { handleUpdateItem } from "./patch-handler";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const supabase = await createClient();
    const data = await handleGetItem(supabase, viewer.id, itemId);
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
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const input = await parseJson(request, wardrobeItemUpdateSchema);
    const supabase = await createClient();
    const data = await handleUpdateItem(supabase, viewer.id, itemId, input);
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
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const supabase = await createClient();
    const data = await handleDeleteItem(supabase, viewer.id, itemId);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
