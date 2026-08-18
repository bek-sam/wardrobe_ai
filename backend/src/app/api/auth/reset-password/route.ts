import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { clearAuthActionCookie } from "@/lib/auth/server";
import { recordAuthEvent } from "@/lib/auth/server";
import { authFailure, mapAuthError } from "@/lib/auth/auth-error";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  consumeAuthAction,
  readAuthAction,
  readAuthActionCookie,
  requireAuthActionSecret,
} from "@/lib/auth/server";

/**
 * Confirms the caller may set a new password.
 *
 * `getUser()` rather than local claims: a reset must act on an identity the
 * Auth server has just confirmed, not on a token that could have been revoked.
 * The challenge is then consumed *before* the password is written, so a
 * double-submitted form or a replayed cookie cannot both succeed.
 */
async function authorizePasswordReset(
  supabase: SupabaseClient,
): Promise<{ ok: true; user: User } | { ok: false }> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false };

  const challenge = readAuthAction(await readAuthActionCookie(), requireAuthActionSecret(), {
    purpose: "password_reset",
    userId: data.user.id,
  });

  const consumed =
    challenge.ok &&
    (await consumeAuthAction({
      nonce: challenge.payload.nonce,
      userId: data.user.id,
      purpose: "password_reset",
    }));

  if (!consumed) {
    await recordAuthEvent({
      type: "recovery_completed",
      result: "rejected",
      userId: data.user.id,
      reason: challenge.ok ? "replayed" : challenge.reason,
    });
    return { ok: false };
  }

  return { ok: true, user: data.user };
}

const EXPIRED = { error: authFailure("reset_session_expired").message };

export async function POST(request: Request) {
  const form = await readAuthForm(request, resetPasswordSchema, "/reset-password");
  if (!form.ok) return form.response;

  const supabase = await createClient();
  const authorized = await authorizePasswordReset(supabase);
  if (!authorized.ok) {
    return clearAuthActionCookie(authRedirect("/forgot-password", EXPIRED));
  }

  const { error } = await supabase.auth.updateUser({ password: form.data.password });
  if (error) {
    await recordAuthEvent({
      type: "recovery_completed",
      result: "failure",
      userId: authorized.user.id,
    });
    return clearAuthActionCookie(
      authRedirect("/reset-password", { error: mapAuthError(error).message }),
    );
  }

  // Whoever knew the old password keeps their sessions otherwise. This is the
  // moment to evict them, and it is why the flow ends at the login screen
  // rather than dropping the user straight into the app.
  await supabase.auth.signOut({ scope: "global" });
  await recordAuthEvent({
    type: "recovery_completed",
    result: "success",
    userId: authorized.user.id,
  });

  return clearAuthActionCookie(
    authRedirect("/login", {
      notice: "Your password was changed and other sessions were signed out. Log in to continue.",
    }),
  );
}
