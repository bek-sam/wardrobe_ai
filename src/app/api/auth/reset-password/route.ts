import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { clearAuthActionCookie } from "@/lib/auth/action-challenges";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authFailure, mapAuthError } from "@/lib/auth/auth-error";
import { createClient } from "@/lib/supabase/server";

import { authorizePasswordReset } from "./authorize";

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
