import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

import {
  consumeAuthAction,
  readAuthAction,
  readAuthActionCookie,
  requireAuthActionSecret,
} from "./action-challenges";
import { requireLiveUser } from "./live-user";
import { type AssuranceState, requireAal2 } from "./mfa";
import { hasRecentAuthentication } from "./recent-auth";

export type SensitiveActionContext = {
  supabase: SupabaseClient;
  user: User;
  assurance: AssuranceState;
};

/**
 * The common gate for anything that changes credentials or removes data:
 * a session the Auth server has just confirmed, plus the second factor when
 * the account has one.
 */
export async function requireSensitiveAction(): Promise<SensitiveActionContext> {
  const { supabase, user } = await requireLiveUser();
  const assurance = await requireAal2(supabase);
  return { supabase, user, assurance };
}

/**
 * Additionally demands that the user proved who they are *recently*.
 *
 * Satisfied either by a fresh authentication on this session, or by a
 * `sensitive_change` challenge minted by an explicit step-up flow. The second
 * path is what keeps this workable: Supabase may report authentication methods
 * without timestamps, and in that case recency cannot be established from the
 * session alone — falling back to "allow" would quietly disable the check, so
 * we require the explicit challenge instead.
 */
export async function requireRecentAuthentication(context: SensitiveActionContext): Promise<void> {
  if (await hasRecentAuthentication(context.supabase)) return;

  const challenge = readAuthAction(await readAuthActionCookie(), requireAuthActionSecret(), {
    purpose: "sensitive_change",
    userId: context.user.id,
  });
  const consumed =
    challenge.ok &&
    (await consumeAuthAction({
      nonce: challenge.payload.nonce,
      userId: context.user.id,
      purpose: "sensitive_change",
    }));

  if (!consumed) {
    throw new ApiError(403, "reauthentication_required", "Confirm it is you before continuing.");
  }
}
