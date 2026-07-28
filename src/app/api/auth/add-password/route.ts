import { addPasswordSchema } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/audit";
import { mapAuthError } from "@/lib/auth/auth-error";
import { hasPasswordIdentity, userIdentities } from "@/lib/auth/identities";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { requireRecentAuthentication, requireSensitiveAction } from "@/lib/auth/sensitive-action";

/**
 * Adds a first password to an account that has only ever signed in with
 * Google.
 *
 * This is `updateUser` on the *existing* user, never a signup — creating a
 * second account for an address that already has one is the failure mode to
 * avoid here, and it is why nothing in this route touches `signUp`.
 *
 * The bar is deliberately high: a live session, a recent proof of identity,
 * the second factor when enrolled, and a confirmed email address. Without the
 * email confirmation check, someone holding a session for an unverified
 * address could attach a password to it and turn a transient foothold into a
 * permanent credential.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, addPasswordSchema);
    const context = await requireSensitiveAction();
    await enforceAuthRateLimit(request, "reauthentication", { userId: context.user.id });
    await requireRecentAuthentication(context);

    if (hasPasswordIdentity(userIdentities(context.user))) {
      throw new ApiError(409, "password_exists", "This account already has a password.");
    }
    if (!context.user.email || !context.user.email_confirmed_at) {
      throw new ApiError(409, "email_unconfirmed", "Confirm your email address first.");
    }

    const { error } = await context.supabase.auth.updateUser({ password: input.password });
    if (error) throw new ApiError(400, "password_update_failed", mapAuthError(error).message);

    await recordAuthEvent({ type: "password_added", result: "success", userId: context.user.id });
    return ok({ added: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
