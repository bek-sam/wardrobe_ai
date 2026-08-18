import { mfaUnenrollSchema } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/server";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireSensitiveAction } from "@/lib/auth/server";

/**
 * Removes an authenticator.
 *
 * Requires AAL2, which is the meaningful part: someone who has stolen a
 * password but not the authenticator must not be able to strip the very
 * control that is stopping them. `requireSensitiveAction` enforces that for
 * any account with a verified factor — which, by definition, includes every
 * account that has a factor to remove.
 *
 * Ownership is enforced by Supabase, which scopes the factor id to the
 * authenticated user; a factor id belonging to someone else resolves to
 * "not found" rather than being removed.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, mfaUnenrollSchema);
    const { supabase, user } = await requireSensitiveAction();

    const { error } = await supabase.auth.mfa.unenroll({ factorId: input.factorId });
    if (error) {
      await recordAuthEvent({ type: "mfa_removed", result: "failure", userId: user.id });
      throw new ApiError(
        400,
        "mfa_unenroll_failed",
        mapAuthError(error, "mfa_factor_not_found").message,
      );
    }

    await recordAuthEvent({ type: "mfa_removed", result: "success", userId: user.id });
    return ok({ removed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
