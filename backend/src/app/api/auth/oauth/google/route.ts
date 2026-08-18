import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect, providerRedirect } from "@/app/api/auth/_lib/redirect";
import { oauthStartSchema } from "@/features/auth/schemas";
import { recordAuthEvent } from "@/lib/auth/server";
import { authFailure } from "@/lib/auth/auth-error";
import { getAuthFlags } from "@/lib/auth/server";
import { setAuthActionCookie } from "@/lib/auth/server";
import type { z } from "zod";
import { issueAuthAction } from "@/lib/auth/server";
import { authCallbackUrl } from "@/lib/auth/server";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireLiveUser } from "@/lib/auth/server";
import { safeReturnTo } from "@/lib/auth/redirects";
import { currentSessionId } from "@/lib/auth/server";
import { googleOAuthOptions } from "./options";
import { type AuthFailure } from "@/lib/auth/auth-error";
import { createClient } from "@/lib/supabase/server";

type OAuthStart =
  | { ok: true; url: string; pendingToken?: string }
  | { ok: false; failure: AuthFailure; failurePath: string };

/**
 * Asks Supabase for the provider authorization URL.
 *
 * The URL it returns is the only external destination this application ever
 * redirects to — it is never assembled from anything a client supplied.
 */
async function oauthProviderUrl(
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

/**
 * Builds the provider URL for each of the three things "continue with Google"
 * can mean. They differ in who must already be signed in, and in what the
 * return trip is allowed to authorize.
 */
async function startGoogleOAuth(input: z.infer<typeof oauthStartSchema>): Promise<OAuthStart> {
  if (input.intent === "signin") {
    return oauthProviderUrl(authCallbackUrl("default", safeReturnTo(input.returnTo)), "/login");
  }

  // Linking and reauthentication both act on an existing account, so the caller
  // is resolved live rather than trusted from the request.
  const { supabase, user } = await requireLiveUser();

  if (input.intent === "link") {
    const { data, error } = await supabase.auth.linkIdentity(
      googleOAuthOptions(authCallbackUrl("default", "/settings")),
    );
    if (error || !data?.url)
      return { ok: false, failure: linkFailure(error), failurePath: "/settings" };
    return { ok: true, url: data.url };
  }

  // Reauthentication: bind the intent to this user *before* leaving, so the
  // account that comes back can be checked against the account that asked.
  const pendingToken = await issueAuthAction({
    userId: user.id,
    purpose: "sensitive_change",
    sessionId: await currentSessionId(supabase),
  });
  const started = await oauthProviderUrl(authCallbackUrl("reauthenticate"), "/settings", true);
  return started.ok ? { ...started, pendingToken } : started;
}

function linkFailure(error: unknown) {
  return error ? mapAuthError(error) : authFailure("unavailable");
}

/**
 * Same-origin POST rather than a client-side redirect, so the flow gets the
 * CSRF check, the feature flag, and `returnTo` sanitizing on the server before
 * the browser ever leaves for Google.
 */
export async function POST(request: Request) {
  const form = await readAuthForm(request, oauthStartSchema, "/login");
  if (!form.ok) return form.response;

  if (!getAuthFlags().googleAuthEnabled) {
    return authRedirect("/login", { error: authFailure("provider_disabled").message });
  }

  try {
    const started = await startGoogleOAuth(form.data);
    if (!started.ok) {
      return authRedirect(started.failurePath, { error: started.failure.message });
    }

    await recordAuthEvent({
      type: "oauth_started",
      result: "success",
      provider: "google",
      reason: form.data.intent,
    });
    // The only external destination we ever emit, and it is the URL Supabase
    // just returned to us — not anything a client supplied.
    const response = providerRedirect(started.url);
    return started.pendingToken ? setAuthActionCookie(response, started.pendingToken) : response;
  } catch {
    console.error("google_oauth_start_failed", { code: "unavailable" });
    return authRedirect("/login", { error: authFailure("unavailable").message });
  }
}
