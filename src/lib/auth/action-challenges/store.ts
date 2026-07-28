import { randomUUID } from "node:crypto";

import { AUTH_ACTION_TTL_SECONDS } from "../constants";
import { requireAuthActionSecret } from "./secret";
import { signAuthAction } from "./token";
import type { AuthActionPayload, AuthActionPurpose } from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mints a challenge: a signed token for the browser plus a durable row that
 * makes it single-use. The signature alone cannot prevent replay — an attacker
 * who captured the cookie could present the same valid token twice — so the
 * database row is the authority, and it is written before the token is handed
 * out.
 */
export async function issueAuthAction(input: {
  userId: string;
  purpose: AuthActionPurpose;
  sessionId?: string | null;
}): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: AuthActionPayload = {
    v: 1,
    purpose: input.purpose,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    nonce: randomUUID(),
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + AUTH_ACTION_TTL_SECONDS,
  };

  const { error } = await createAdminClient().rpc("issue_auth_action_challenge", {
    p_nonce: payload.nonce,
    p_user_id: payload.userId,
    p_purpose: payload.purpose,
    p_session_id: payload.sessionId,
    p_expires_at: new Date(payload.expiresAt * 1000).toISOString(),
  });
  if (error) throw new Error("auth_action_challenge_issue_failed");

  return signAuthAction(payload, requireAuthActionSecret());
}

/**
 * Atomically marks the challenge used. Returns false when it was already
 * consumed, has expired, or never belonged to this user and purpose — the
 * database `update ... where consumed_at is null` is what makes two concurrent
 * replays resolve to exactly one winner.
 */
export async function consumeAuthAction(input: {
  nonce: string;
  userId: string;
  purpose: AuthActionPurpose;
}): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("consume_auth_action_challenge", {
    p_nonce: input.nonce,
    p_user_id: input.userId,
    p_purpose: input.purpose,
  });
  return !error && data === true;
}
