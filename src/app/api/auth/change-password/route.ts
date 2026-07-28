import { changePasswordSchema } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/audit";
import { mapAuthError } from "@/lib/auth/auth-error";
import { userIdentities, hasPasswordIdentity } from "@/lib/auth/identities";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { requireSensitiveAction } from "@/lib/auth/sensitive-action";
import { verifyPassword } from "@/lib/supabase/verifier";

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, changePasswordSchema);
    const { supabase, user } = await requireSensitiveAction();
    await enforceAuthRateLimit(request, "reauthentication", { userId: user.id });

    // "Has an email claim" is not evidence of a password: a Google-only
    // account has one too. Only an `email` identity proves one exists.
    if (!hasPasswordIdentity(userIdentities(user)) || !user.email) {
      throw new ApiError(409, "password_unavailable", "This account has no password to change.");
    }
    if (!(await verifyPassword(user.email, input.currentPassword))) {
      await recordAuthEvent({ type: "password_changed", result: "rejected", userId: user.id });
      throw new ApiError(401, "reauthentication_failed", "That did not match our records.");
    }

    const { error } = await supabase.auth.updateUser({
      password: input.password,
      // Honoured when the project requires it; harmlessly ignored otherwise.
      // The explicit check above is what guarantees verification either way.
      current_password: input.currentPassword,
    });
    if (error) throw new ApiError(400, "password_update_failed", mapAuthError(error).message);

    // Anyone who had the old password loses their foothold immediately.
    await supabase.auth.signOut({ scope: "others" });
    await recordAuthEvent({ type: "password_changed", result: "success", userId: user.id });

    return ok(
      { changed: true, other_sessions_signed_out: true },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}
