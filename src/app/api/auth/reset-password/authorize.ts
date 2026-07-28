import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  consumeAuthAction,
  readAuthAction,
  readAuthActionCookie,
  requireAuthActionSecret,
} from "@/lib/auth/action-challenges";
import { recordAuthEvent } from "@/lib/auth/audit";

/**
 * Confirms the caller may set a new password.
 *
 * `getUser()` rather than local claims: a reset must act on an identity the
 * Auth server has just confirmed, not on a token that could have been revoked.
 * The challenge is then consumed *before* the password is written, so a
 * double-submitted form or a replayed cookie cannot both succeed.
 */
export async function authorizePasswordReset(
  supabase: SupabaseClient,
): Promise<{ ok: true; user: User } | { ok: false }> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false };

  const challenge = readAuthAction(await readAuthActionCookie(), requireAuthActionSecret(), {
    purpose: "password_reset",
    userId: data.user.id,
  });

  const consumed =
    challenge.ok &&
    (await consumeAuthAction({
      nonce: challenge.payload.nonce,
      userId: data.user.id,
      purpose: "password_reset",
    }));

  if (!consumed) {
    await recordAuthEvent({
      type: "recovery_completed",
      result: "rejected",
      userId: data.user.id,
      reason: challenge.ok ? "replayed" : challenge.reason,
    });
    return { ok: false };
  }

  return { ok: true, user: data.user };
}
