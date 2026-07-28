import { accountDeletionSchema } from "@/app/api/_lib/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { requireSensitiveAction } from "@/lib/auth/sensitive-action";
import { clearAuthActionCookie } from "@/lib/auth/action-challenges";

import { handleDeleteAccount } from "./handler";

export async function DELETE(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, accountDeletionSchema);
    // Live user plus AAL2 when a factor is enrolled: a stolen password alone
    // must not be able to erase an MFA-protected account.
    const { supabase, user } = await requireSensitiveAction();
    await enforceAuthRateLimit(request, "reauthentication", { userId: user.id });

    const data = await handleDeleteAccount(supabase, user, input.confirmation, input.password);
    return clearAuthActionCookie(ok(data, { headers: { "Cache-Control": "no-store" } }));
  } catch (error) {
    return routeError(error);
  }
}
