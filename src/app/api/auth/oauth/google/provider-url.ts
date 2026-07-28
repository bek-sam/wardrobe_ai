import { authFailure, mapAuthError, type AuthFailure } from "@/lib/auth/auth-error";
import { createClient } from "@/lib/supabase/server";

import { googleOAuthOptions } from "./options";

export type OAuthStart =
  | { ok: true; url: string; pendingToken?: string }
  | { ok: false; failure: AuthFailure; failurePath: string };

/**
 * Asks Supabase for the provider authorization URL.
 *
 * The URL it returns is the only external destination this application ever
 * redirects to — it is never assembled from anything a client supplied.
 */
export async function oauthProviderUrl(
  redirectTo: string,
  failurePath: string,
  forceAccountPrompt = false,
): Promise<OAuthStart> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth(
    googleOAuthOptions(redirectTo, forceAccountPrompt),
  );

  if (error || !data?.url) {
    return {
      ok: false,
      failure: error ? mapAuthError(error) : authFailure("unavailable"),
      failurePath,
    };
  }
  return { ok: true, url: data.url };
}
