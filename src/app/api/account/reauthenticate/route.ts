import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ok, routeError } from "@/lib/api/response";
import { setAuthActionCookie } from "@/lib/auth/action-challenges";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { requireSensitiveAction } from "@/lib/auth/sensitive-action";

import { startDeletionReauthentication } from "./start";

/**
 * Starts the step-up a Google or passwordless account needs before deletion.
 *
 * The `sensitive_change` challenge is minted *here*, before the user leaves
 * for the provider, and the cookie carries it across the round trip. The
 * callback then compares the identity that comes back against the identity
 * recorded in that challenge — without which, authenticating as any account at
 * the provider would satisfy a deletion started by a different one.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const { supabase, user } = await requireSensitiveAction();
    await enforceAuthRateLimit(request, "reauthentication", { userId: user.id });

    const started = await startDeletionReauthentication(supabase, user);
    return setAuthActionCookie(
      ok(
        { method: started.method, redirect_url: started.redirectUrl ?? null },
        { headers: { "Cache-Control": "no-store" } },
      ),
      started.pendingToken,
    );
  } catch (error) {
    return routeError(error);
  }
}
