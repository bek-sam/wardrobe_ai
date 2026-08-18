import { authRedirect } from "@/app/api/auth/_lib/redirect";
import {
  clearAuthActionCookie,
  consumeAuthAction,
  issueAuthAction,
  readAuthAction,
  readAuthActionCookie,
  requireAuthActionSecret,
  setAuthActionCookie,
} from "@/lib/auth/server";
import { recordAuthEvent } from "@/lib/auth/server";
import { authFailure } from "@/lib/auth/auth-error";
import { currentSessionId } from "@/lib/auth/server";

import { exchangeCallbackCode } from "./../_lib/exchange";

/**
 * Redeems the `sensitive_change` challenge that was minted *before* the
 * provider redirect.
 *
 * The user id inside it is compared against the identity that came back. That
 * comparison is the point of the whole round trip: without it, authenticating
 * as any account at the provider would satisfy a step-up started by a
 * different account — "reauthenticate as yourself, delete someone else".
 */
async function consumePendingReauthentication(
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const pending = readAuthAction(await readAuthActionCookie(), requireAuthActionSecret(), {
    purpose: "sensitive_change",
    userId,
  });
  if (!pending.ok) return { ok: false, reason: pending.reason };

  const consumed = await consumeAuthAction({
    nonce: pending.payload.nonce,
    userId,
    purpose: "sensitive_change",
  });
  return consumed ? { ok: true } : { ok: false, reason: "replayed" };
}

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
