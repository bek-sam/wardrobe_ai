import type { SupabaseClient, User } from "@supabase/supabase-js";

import { authFailure, mapAuthError, type AuthFailure } from "@/lib/auth/auth-error";
import { createClient } from "@/lib/supabase/server";

export type CallbackExchange =
  { ok: true; supabase: SupabaseClient; user: User } | { ok: false; failure: AuthFailure };

/**
 * Redeems the one-time PKCE code on an auth callback.
 *
 * Two things are deliberate here. First, provider-reported failures (the user
 * pressed "Cancel" on Google's consent screen, or the link had already been
 * used) arrive as `error` query parameters rather than as an exchange failure,
 * so they are checked before anything else. Second, the caller is resolved
 * with `getUser()` rather than from the exchange response: everything
 * downstream of a callback is sensitive — minting a password-reset challenge,
 * authorizing a deletion — and those must act on an identity the Auth server
 * has just confirmed, not one parsed out of a redirect.
 */
export async function exchangeCallbackCode(url: URL): Promise<CallbackExchange> {
  if (url.searchParams.get("error")) {
    return { ok: false, failure: authFailure("expired_link") };
  }

  const code = url.searchParams.get("code");
  if (!code) return { ok: false, failure: authFailure("expired_link") };

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { ok: false, failure: mapAuthError(error, "expired_link") };

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return { ok: false, failure: authFailure("expired_link") };

  return { ok: true, supabase, user: data.user };
}
