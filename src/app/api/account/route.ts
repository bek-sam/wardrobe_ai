import { accountDeletionSchema } from "@/app/api/_lib/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleDeleteAccount } from "./handler";

export async function DELETE(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, accountDeletionSchema);
    const supabase = await createClient();

    const data = await handleDeleteAccount(supabase, viewer, input.confirmation, input.password);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
