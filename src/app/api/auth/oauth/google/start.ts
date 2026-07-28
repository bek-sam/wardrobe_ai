import type { z } from "zod";

import type { oauthStartSchema } from "@/features/auth/schemas";
import { issueAuthAction } from "@/lib/auth/action-challenges";
import { authCallbackUrl } from "@/lib/auth/app-url";
import { authFailure, mapAuthError } from "@/lib/auth/auth-error";
import { requireLiveUser } from "@/lib/auth/live-user";
import { safeReturnTo } from "@/lib/auth/redirects";
import { currentSessionId } from "@/lib/auth/session-id";

import { googleOAuthOptions } from "./options";
import { oauthProviderUrl, type OAuthStart } from "./provider-url";

/**
 * Builds the provider URL for each of the three things "continue with Google"
 * can mean. They differ in who must already be signed in, and in what the
 * return trip is allowed to authorize.
 */
export async function startGoogleOAuth(
  input: z.infer<typeof oauthStartSchema>,
): Promise<OAuthStart> {
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
