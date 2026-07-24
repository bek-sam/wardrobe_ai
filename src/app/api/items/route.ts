import { wardrobeItemCreateSchema } from "@/features/wardrobe/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { itemListQuerySchema } from "../_lib/schemas";
import { parseQuery } from "../_lib/route";
import { handleListItems } from "./get-handler";
import { handleCreateItem } from "./post-handler";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, itemListQuerySchema);
    const supabase = await createClient();
    const data = await handleListItems(supabase, viewer.id, filters);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, wardrobeItemCreateSchema);
    const supabase = await createClient();
    const data = await handleCreateItem(supabase, viewer.id, input);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
