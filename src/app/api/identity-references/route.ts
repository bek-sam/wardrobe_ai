import { confirmIdentityUploadSchema } from "@/lib/visualization";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleConfirmIdentityUpload } from "./confirm-handler";
import { handleGetIdentityReferences } from "./get-handler";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const data = await handleGetIdentityReferences(supabase, viewer.id);
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, confirmIdentityUploadSchema),
      createClient(),
    ]);
    const data = await handleConfirmIdentityUpload(supabase, viewer.id, input.storagePath);
    return ok(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
