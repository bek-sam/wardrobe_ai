import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { destinationAfterFirstFactor } from "@/app/api/auth/login/destination";
import { recordAuthEvent } from "@/lib/auth/audit";
import { safeReturnTo } from "@/lib/auth/redirects";

import { exchangeCallbackCode } from "./_lib/exchange";

/**
 * The ordinary callback: email confirmation, Google sign-in, and email-change
 * confirmation all land here.
 *
 * It has no power to authorize anything sensitive. Password reset and
 * reauthentication have their own callbacks precisely so that a confirmation
 * link — the most widely forwarded, longest-lived link we send — can never be
 * redeemed for a password-change challenge.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  const exchange = await exchangeCallbackCode(url);
  if (!exchange.ok) {
    await recordAuthEvent({ type: "confirmation_completed", result: "failure" });
    return authRedirect("/login", { error: exchange.failure.message });
  }

  await recordAuthEvent({
    type: "confirmation_completed",
    result: "success",
    userId: exchange.user.id,
  });
  return authRedirect(await destinationAfterFirstFactor(exchange.supabase, returnTo));
}
