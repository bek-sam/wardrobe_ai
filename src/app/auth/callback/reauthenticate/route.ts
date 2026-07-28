import { authRedirect } from "@/app/api/auth/_lib/redirect";
import {
  clearAuthActionCookie,
  issueAuthAction,
  setAuthActionCookie,
} from "@/lib/auth/action-challenges";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authFailure } from "@/lib/auth/auth-error";
import { currentSessionId } from "@/lib/auth/session-id";

import { exchangeCallbackCode } from "./../_lib/exchange";
import { consumePendingReauthentication } from "./consume-pending";

/**
 * Step-up landing for Google and passwordless accounts about to do something
 * destructive. Trades the pending `sensitive_change` challenge for a one-time
 * `account_deletion` authorization, but only when the identity coming back
 * matches the one that started the flow.
 */
export async function GET(request: Request) {
  const exchange = await exchangeCallbackCode(new URL(request.url));
  if (!exchange.ok) {
    return clearAuthActionCookie(authRedirect("/settings", { error: exchange.failure.message }));
  }

  const pending = await consumePendingReauthentication(exchange.user.id);
  if (!pending.ok) {
    await recordAuthEvent({
      type: "deletion_requested",
      result: "rejected",
      userId: exchange.user.id,
      reason: pending.reason,
    });
    return clearAuthActionCookie(
      authRedirect("/settings", { error: authFailure("reauthentication_failed").message }),
    );
  }

  const token = await issueAuthAction({
    userId: exchange.user.id,
    purpose: "account_deletion",
    sessionId: await currentSessionId(exchange.supabase),
  });
  return setAuthActionCookie(
    authRedirect("/settings", { notice: "Identity confirmed. Confirm deletion to continue." }),
    token,
  );
}
