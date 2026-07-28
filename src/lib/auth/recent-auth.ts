import type { SupabaseClient } from "@supabase/supabase-js";

import { RECENT_AUTH_MAX_AGE_SECONDS } from "./constants";

type AuthenticationMethod = string | { method?: string; timestamp?: number };

/**
 * Newest timestamp among the session's authentication methods, in UNIX
 * seconds, or `null` when none carries one.
 *
 * Supabase may report methods either as RFC-8176 strings (`["password"]`) or
 * as objects with timestamps. The string form proves *how* the user
 * authenticated but not *when*, so it cannot establish recency and is skipped
 * — callers must then fall back to an explicit reauthentication challenge.
 */
export function latestAuthenticationAt(methods: readonly AuthenticationMethod[]): number | null {
  let latest: number | null = null;
  for (const entry of methods) {
    if (typeof entry === "string") continue;
    const timestamp = entry.timestamp;
    if (typeof timestamp === "number" && (latest === null || timestamp > latest)) {
      latest = timestamp;
    }
  }
  return latest;
}

export function isRecentAuthentication(
  latestAt: number | null,
  now: number = Date.now(),
  maxAgeSeconds: number = RECENT_AUTH_MAX_AGE_SECONDS,
): boolean {
  if (latestAt === null) return false;
  const ageSeconds = now / 1000 - latestAt;
  // A timestamp in the future means clock skew or a tampered claim; neither is
  // evidence of a recent, deliberate authentication.
  return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds;
}

/** Whether this session authenticated recently enough to skip a step-up prompt. */
export async function hasRecentAuthentication(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return isRecentAuthentication(latestAuthenticationAt(data.currentAuthenticationMethods));
}
