import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect, providerRedirect } from "@/app/api/auth/_lib/redirect";
import { oauthStartSchema } from "@/features/auth/schemas";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authFailure } from "@/lib/auth/auth-error";
import { getAuthFlags } from "@/lib/auth/flags";
import { setAuthActionCookie } from "@/lib/auth/action-challenges";

import { startGoogleOAuth } from "./start";

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
