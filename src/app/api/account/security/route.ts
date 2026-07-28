import { ok, routeError } from "@/lib/api/response";
import { requireLiveUser } from "@/lib/auth/live-user";

import { buildAccountSecurity } from "./build-dto";

/**
 * The account's security state for the Settings page.
 *
 * Resolved with `getUser()` rather than local claims because it reports things
 * a stale token would get wrong — whether the email is confirmed, which
 * identities are linked, whether a factor still exists.
 *
 * `no-store` because the response is specific to one signed-in user; a shared
 * cache holding it would be a cross-account disclosure.
 */
export async function GET() {
  try {
    const { supabase, user } = await requireLiveUser();
    return ok(await buildAccountSecurity(supabase, user), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}
