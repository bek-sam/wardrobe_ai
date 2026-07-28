import { requireEnvironment } from "@/lib/env/server";

/**
 * Auth actions fail closed when unconfigured. Without a signing key there is
 * no way to tell a challenge we minted from one an attacker wrote, so the
 * flows that depend on it (password reset, deletion reauthentication) refuse
 * to run rather than accepting unauthenticated tokens.
 */
export function requireAuthActionSecret(): string {
  return requireEnvironment("AUTH_ACTION_SECRET").AUTH_ACTION_SECRET;
}
