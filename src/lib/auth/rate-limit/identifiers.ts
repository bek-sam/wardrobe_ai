import { createHmac } from "node:crypto";

import { requireEnvironment } from "@/lib/env/server";

import type { RateLimitScope } from "./policies.data";

/** Bucket used when no trustworthy client IP is available for this deployment. */
export const UNKNOWN_IP_IDENTIFIER = "unknown-proxy";

function secret(): string {
  return requireEnvironment("AUTH_RATE_LIMIT_HMAC_SECRET").AUTH_RATE_LIMIT_HMAC_SECRET;
}

/**
 * Emails are lower-cased *for bucketing only*, so `A@x.test` and `a@x.test`
 * share a counter rather than doubling an attacker's budget. The address used
 * for authentication is never modified.
 */
export function normalizeRateLimitEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Turns an identifier into an opaque bucket key. The table therefore holds no
 * raw email addresses and no raw IPs — someone who reads it learns that *some*
 * address was throttled, not whose.
 *
 * The scope is part of the signed message, so the same string used as an email
 * and as a user ID produces two different buckets and cannot be made to share
 * a budget.
 */
export function rateLimitIdentifier(scope: RateLimitScope, value: string): string {
  const normalized = scope === "email" ? normalizeRateLimitEmail(value) : value.trim();
  return createHmac("sha256", secret()).update(`${scope}:${normalized}`).digest("hex");
}
