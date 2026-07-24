import { outfitCreateSchema, outfitListQuerySchema } from "@/app/api/_lib/schemas";
import { parseQuery } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleListOutfits } from "./get-handler";
import { handleCreateOutfit } from "./post-handler";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, outfitListQuerySchema);
    const supabase = await createClient();
    const data = await handleListOutfits(supabase, viewer.id, filters);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const input = await parseJson(request, outfitCreateSchema);
    const supabase = await createClient();
    const data = await handleCreateOutfit(supabase, input);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
