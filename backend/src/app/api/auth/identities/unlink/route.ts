import { z } from "zod";

import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/server";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireRecentAuthentication, requireSensitiveAction } from "@/lib/auth/server";
import { canUnlinkIdentity } from "@/lib/auth/server";
import { normalizeIdentities } from "@/lib/auth/server";

/**
 * Why an unlink was refused, in words the user can act on.
 *
 * `last_recovery_method` is the one worth spelling out: the account still has
 * another way in today, but removing this one would leave nothing that can get
 * the user back should that other credential be lost.
 */
const UNLINK_REFUSALS = {
  not_linked: {
    status: 404,
    message: "That sign-in method is not linked to your account.",
  },
  last_identity: {
    status: 409,
    message: "Add another sign-in method before removing this one — it is the only way in.",
  },
  last_recovery_method: {
    status: 409,
    message:
      "This is your only recoverable sign-in method. Add a password or link Google first, otherwise losing the other method would lock you out for good.",
  },
} as const;

const unlinkSchema = z.object({ identityId: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, unlinkSchema);
    const context = await requireSensitiveAction();
    await requireRecentAuthentication(context);

    // Read live rather than from the cached user: the set of identities is
    // exactly what the last-identity rule depends on.
    const { data, error: listError } = await context.supabase.auth.getUserIdentities();
    if (listError || !data) throw new ApiError(400, "identity_lookup_failed", "Try again.");

    const decision = canUnlinkIdentity(normalizeIdentities(data.identities), input.identityId);
    if (!decision.allowed) {
      const refusal = UNLINK_REFUSALS[decision.reason];
      throw new ApiError(refusal.status, decision.reason, refusal.message);
    }

    // Passed by object, and only after we matched it in the caller's own
    // identity list, so a foreign identity id can never reach this call.
    const target = data.identities.find((item) => item.identity_id === input.identityId)!;
    const { error } = await context.supabase.auth.unlinkIdentity(target);
    if (error) throw new ApiError(400, "identity_unlink_failed", mapAuthError(error).message);

    await recordAuthEvent({
      type: "identity_unlinked",
      result: "success",
      userId: context.user.id,
    });
    return ok({ unlinked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
