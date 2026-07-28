import { emailChangeSchema } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { authCallbackUrl } from "@/lib/auth/app-url";
import { recordAuthEvent } from "@/lib/auth/audit";
import { mapAuthError } from "@/lib/auth/auth-error";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { requireRecentAuthentication, requireSensitiveAction } from "@/lib/auth/sensitive-action";

/**
 * Starts an email change. Nothing moves until *both* addresses confirm — the
 * project's double-confirmation setting means the old mailbox is notified and
 * must approve, so a hijacked session cannot quietly relocate the account
 * beyond the real owner's reach.
 *
 * The current address is not replaced here; it stays authoritative until the
 * confirmations complete, and the UI shows the new one only as pending.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, emailChangeSchema);
    const context = await requireSensitiveAction();
    await enforceAuthRateLimit(request, "reauthentication", { userId: context.user.id });
    await requireRecentAuthentication(context);

    if (context.user.email?.toLowerCase() === input.newEmail.toLowerCase()) {
      throw new ApiError(422, "email_unchanged", "That is already your email address.");
    }

    const { error } = await context.supabase.auth.updateUser(
      { email: input.newEmail },
      { emailRedirectTo: authCallbackUrl("default", "/settings") },
    );
    if (error) {
      await recordAuthEvent({
        type: "email_change_requested",
        result: "failure",
        userId: context.user.id,
      });
      // Generic: a distinguishable "already in use" would confirm that some
      // other account holds that address.
      throw new ApiError(
        400,
        "email_change_failed",
        mapAuthError(error, "email_change_failed").message,
      );
    }

    await recordAuthEvent({
      type: "email_change_requested",
      result: "success",
      userId: context.user.id,
    });
    return ok({ pending: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
