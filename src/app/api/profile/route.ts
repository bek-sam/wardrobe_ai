import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { profileUpdateSchema } from "../_lib/schemas";
import { handleGetProfile } from "./get-handler";
import { handleUpdateProfile } from "./patch-handler";

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const data = await handleGetProfile(supabase, viewer.id);
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
    const input = await parseJson(request, profileUpdateSchema);
    const supabase = await createClient();
    const data = await handleUpdateProfile(supabase, viewer.id, input);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
