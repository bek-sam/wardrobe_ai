import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { styleProfileUpdateSchema } from "../_lib/schemas";
import { handleGetStyleProfile } from "./get-handler";
import { handleUpdateStyleProfile } from "./patch-handler";

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const data = await handleGetStyleProfile(supabase, viewer.id);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, styleProfileUpdateSchema);
    const supabase = await createClient();
    const { data, status } = await handleUpdateStyleProfile(supabase, viewer.id, input);
    return ok(data, { status });
  } catch (error) {
    return routeError(error);
  }
}
