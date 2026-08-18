import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { logoutSchema } from "@/features/auth/schemas";
import { recordAuthEvent } from "@/lib/auth/server";
import { authFailure } from "@/lib/auth/auth-error";
import { createClient } from "@/lib/supabase/server";

/**
 * Where each sign-out scope lands and what the user is told.
 *
 * The copy names the scope explicitly, because "signed out" is ambiguous in a
 * product with three different sign-out buttons, and because a user who
 * pressed "sign out everywhere" after losing a device needs to know it
 * actually covered this device too.
 *
 * The note about already-issued tokens is not a disclaimer for its own sake:
 * revocation invalidates refresh tokens immediately, but an access token
 * already in flight stays valid until it expires (one hour by default).
 */
const LOGOUT_OUTCOMES = {
  local: {
    path: "/login",
    notice: "You are signed out on this device. Your other devices are still signed in.",
  },
  others: {
    path: "/settings",
    notice:
      "Your other devices were signed out; this one stays signed in. Access already granted elsewhere can persist for up to an hour.",
  },
  global: {
    path: "/login",
    notice:
      "You are signed out everywhere, including this device. Access already granted can persist for up to an hour.",
  },
} as const;

/**
 * Sign-out with an explicit, validated scope.
 *
 * `others` is the one scope that must not clear local credentials — that is
 * the entire point of "sign out my other devices". `local` and `global` both
 * end this session, and `global` additionally revokes every refresh token on
 * the account.
 */
export async function POST(request: Request) {
  const form = await readAuthForm(request, logoutSchema, "/settings");
  if (!form.ok) return form.response;
  const { scope } = form.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope });
  await recordAuthEvent({ type: "logout", result: error ? "failure" : "success", reason: scope });

  if (error) {
    // A failed *remote* revocation must not be reported as a clean sign-out.
    // The local session is still dropped when that was part of the intent, so
    // this device is secured either way, but the user is told plainly that
    // other sessions may have survived.
    if (scope !== "others") await supabase.auth.signOut({ scope: "local" });
    const message = authFailure("logout_partial").message;
    return scope === "others"
      ? authRedirect("/settings", { error: message })
      : authRedirect("/login", { error: message });
  }

  const outcome = LOGOUT_OUTCOMES[scope];
  return authRedirect(outcome.path, { notice: outcome.notice });
}
