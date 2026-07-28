import {
  consumeAuthAction,
  readAuthAction,
  readAuthActionCookie,
  requireAuthActionSecret,
} from "@/lib/auth/action-challenges";

/**
 * Redeems the `sensitive_change` challenge that was minted *before* the
 * provider redirect.
 *
 * The user id inside it is compared against the identity that came back. That
 * comparison is the point of the whole round trip: without it, authenticating
 * as any account at the provider would satisfy a step-up started by a
 * different account — "reauthenticate as yourself, delete someone else".
 */
export async function consumePendingReauthentication(
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
