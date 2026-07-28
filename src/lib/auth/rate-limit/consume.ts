import { createAdminClient } from "@/lib/supabase/admin";

import { rateLimitIdentifier, UNKNOWN_IP_IDENTIFIER } from "./identifiers";
import { AUTH_RATE_LIMITS, type AuthRateLimitAction, type RateLimitRule } from "./policies.data";

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimitSubject = { email?: string; ip?: string | null; userId?: string };

function subjectValue(rule: RateLimitRule, subject: RateLimitSubject): string | null {
  if (rule.scope === "email") return subject.email ?? null;
  if (rule.scope === "user") return subject.userId ?? null;
  // No trustworthy client IP means everyone shares one coarse bucket, which is
  // weak but honest — far better than hashing a header a client can forge and
  // calling the result per-client protection.
  return subject.ip ?? UNKNOWN_IP_IDENTIFIER;
}

/**
 * Charges every bucket for an action, stopping at the first denial so a
 * rejected request does not also burn the remaining budgets.
 *
 * Failures are treated as denials. This limiter guards the same Postgres that
 * Supabase Auth itself depends on, so an unreachable database is not a
 * situation where sign-in would otherwise be succeeding — and an abuse control
 * that silently disables itself under load is not a control.
 */
export async function consumeAuthRateLimit(
  action: AuthRateLimitAction,
  subject: RateLimitSubject,
): Promise<RateLimitDecision> {
  const admin = createAdminClient();

  for (const rule of AUTH_RATE_LIMITS[action] as readonly RateLimitRule[]) {
    const value = subjectValue(rule, subject);
    if (value === null) continue;

    const { data, error } = await admin.rpc("consume_auth_rate_limit", {
      p_action: action,
      p_identifier_hash: rateLimitIdentifier(rule.scope, value),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) return { allowed: false, retryAfterSeconds: 60 };

    const result = data as { allowed?: boolean; retry_after_seconds?: number } | null;
    if (!result?.allowed) {
      return { allowed: false, retryAfterSeconds: Math.max(1, result?.retry_after_seconds ?? 60) };
    }
  }

  return { allowed: true };
}
