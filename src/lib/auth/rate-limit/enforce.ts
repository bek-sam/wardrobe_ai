import { RateLimitError } from "@/lib/api/response";
import { trustedClientIp } from "@/lib/api/client-ip";

import { consumeAuthRateLimit, type RateLimitSubject } from "./consume";
import type { AuthRateLimitAction } from "./policies.data";

/**
 * Charges an action's limits and throws `RateLimitError` when any bucket is
 * exhausted. Callers run this *before* touching Supabase, sending mail, or
 * hashing a password, so a flood costs us one indexed upsert rather than a
 * provider round trip.
 */
export async function enforceAuthRateLimit(
  request: Request,
  action: AuthRateLimitAction,
  subject: Omit<RateLimitSubject, "ip"> = {},
): Promise<void> {
  const decision = await consumeAuthRateLimit(action, {
    ...subject,
    ip: trustedClientIp(request),
  });
  if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds);
}
