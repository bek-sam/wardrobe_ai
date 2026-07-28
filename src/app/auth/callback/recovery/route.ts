import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authFailure } from "@/lib/auth/auth-error";
import { issueAuthAction, setAuthActionCookie } from "@/lib/auth/action-challenges";
import { currentSessionId } from "@/lib/auth/session-id";

import { exchangeCallbackCode } from "./../_lib/exchange";

/**
 * The only place a password-reset challenge is minted.
 *
 * Redeeming the recovery code produces a signed session, which on its own
 * would already be enough to change the password — that is exactly the problem
 * with treating every callback alike. Instead the recovery *intent* is
 * captured in a separate, single-use challenge bound to this user, this
 * purpose, and a ten-minute expiry, and `/api/auth/reset-password` refuses to
 * act without it. A visit to Settings with the same session cannot change the
 * password, and a replayed link cannot either.
 *
 * The challenge carries no access or refresh token; it is an authorization
 * marker, not a credential.
 */
export async function GET(request: Request) {
  const exchange = await exchangeCallbackCode(new URL(request.url));
  if (!exchange.ok) {
    await recordAuthEvent({ type: "recovery_completed", result: "failure", provider: "email" });
    return authRedirect("/forgot-password", { error: exchange.failure.message });
  }

  try {
    const token = await issueAuthAction({
      userId: exchange.user.id,
      purpose: "password_reset",
      sessionId: await currentSessionId(exchange.supabase),
    });
    return setAuthActionCookie(authRedirect("/reset-password"), token);
  } catch {
    console.error("recovery_challenge_issue_failed", { code: "unavailable" });
    return authRedirect("/forgot-password", { error: authFailure("unavailable").message });
  }
}
