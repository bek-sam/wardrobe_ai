import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { logoutSchema } from "@/features/auth/schemas";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authFailure } from "@/lib/auth/auth-error";
import { createClient } from "@/lib/supabase/server";

import { LOGOUT_OUTCOMES } from "./outcomes.data";

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
