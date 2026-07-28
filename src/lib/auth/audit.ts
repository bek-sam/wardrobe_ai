import { createAdminClient } from "@/lib/supabase/admin";

import type { AuthEventResult, AuthEventType } from "./audit-events.data";
import type { SupportedProvider } from "./providers.data";

export type AuthEvent = {
  type: AuthEventType;
  result: AuthEventResult;
  /** Only when the actor is already authenticated. Never for pre-auth flows. */
  userId?: string | null;
  provider?: SupportedProvider | null;
  /** Our own stable code, e.g. `invalid_credentials`. Never a provider string. */
  reason?: string | null;
};

/**
 * Records an operational auth event.
 *
 * Fire-and-forget on purpose: an audit write must never be the reason a user
 * cannot sign in or delete their account. A failure is swallowed after a
 * code-only console line, because the alternative — surfacing it — would turn
 * a logging outage into an authentication outage.
 *
 * Pre-authentication flows (login attempts, recovery requests) pass no
 * `userId`. Resolving one would mean looking up the address, which is both an
 * enumeration oracle and a record of who tried to sign in and when.
 */
export async function recordAuthEvent(event: AuthEvent): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("auth_events")
      .insert({
        event_type: event.type,
        result: event.result,
        user_id: event.userId ?? null,
        provider: event.provider ?? null,
        reason: event.reason ?? null,
      });
    if (error) console.error("auth_event_write_failed", { code: error.code });
  } catch {
    console.error("auth_event_write_failed", { code: "unavailable" });
  }
}
