import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { destinationAfterFirstFactor } from "@/app/api/auth/login/destination";
import { recordAuthEvent } from "@/lib/auth/server";
import { safeReturnTo } from "@/lib/auth/redirects";

import { exchangeCallbackCode } from "./../_lib/exchange";

/**
 * Passwordless sign-in landing. A magic link satisfies the *first* factor
 * only: `destinationAfterFirstFactor` still routes an MFA-enrolled account to
 * the challenge, so emailing yourself a link is not a way around the second
 * factor.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  const exchange = await exchangeCallbackCode(url);
  if (!exchange.ok) {
    await recordAuthEvent({ type: "login_attempted", result: "failure", provider: "email" });
    return authRedirect("/login", { error: exchange.failure.message });
  }

  await recordAuthEvent({
    type: "login_attempted",
    result: "success",
    provider: "email",
    userId: exchange.user.id,
  });
  return authRedirect(await destinationAfterFirstFactor(exchange.supabase, returnTo));
}
