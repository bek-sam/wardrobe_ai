import {
  consumeAuthAction,
  readAuthAction,
  readAuthActionCookie,
  requireAuthActionSecret,
} from "@/lib/auth/server";

/**
 * Redeems the one-time `account_deletion` authorization.
 *
 * Only the reauthentication callback can mint one, and only after confirming
 * the identity returning from the provider is the same one that started the
 * flow. Consuming it here means a replayed cookie authorizes nothing.
 */
export async function consumeDeletionAuthorization(userId: string): Promise<boolean> {
  const challenge = readAuthAction(await readAuthActionCookie(), requireAuthActionSecret(), {
    purpose: "account_deletion",
    userId,
  });
  if (!challenge.ok) return false;

  return consumeAuthAction({
    nonce: challenge.payload.nonce,
    userId,
    purpose: "account_deletion",
  });
}
