import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

export type LiveSession = { supabase: SupabaseClient; user: User };

/**
 * Resolves the caller by asking the Auth server, not by verifying the JWT we
 * were handed.
 *
 * `getClaims()` is the right tool for ordinary reads: it is a local signature
 * check, so it is fast and it cannot be forged. What it cannot see is
 * *revocation* — a token stays cryptographically valid until it expires, so a
 * session signed out on another device, an account that has since been
 * deleted, or a user banned minutes ago all still present a perfectly valid
 * token. For anything destructive or credential-changing, that window is not
 * acceptable, so this round-trips to `getUser()` and lets the server decide.
 *
 * Use `requireViewer()` for reads; use this for password/email changes,
 * identity changes, MFA changes, export, and deletion.
 */
export async function requireLiveUser(): Promise<LiveSession> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ApiError(401, "authentication_required", "Sign in again to continue.");
  }

  return { supabase, user: data.user };
}
