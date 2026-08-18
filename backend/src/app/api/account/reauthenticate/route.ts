import type { SupabaseClient, User } from "@supabase/supabase-js";

import { googleOAuthOptions } from "@/app/api/auth/oauth/google/options";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, routeError } from "@/lib/api/response";
import { issueAuthAction, setAuthActionCookie } from "@/lib/auth/server";
import { authCallbackUrl } from "@/lib/auth/server";
import { enforceAuthRateLimit } from "@/lib/auth/server";
import { requireSensitiveAction } from "@/lib/auth/server";
import { currentSessionId } from "@/lib/auth/server";
import { deletionReauthMethod, type DeletionReauthMethod } from "../handler";

type ReauthenticationStart = {
  method: DeletionReauthMethod;
  redirectUrl?: string;
  pendingToken: string;
};

async function startDeletionReauthentication(
  supabase: SupabaseClient,
  user: User,
): Promise<ReauthenticationStart> {
  const method = deletionReauthMethod(user);
  if (method === "password") {
    throw new ApiError(409, "password_reauthentication", "Re-enter your password instead.");
  }

  const pendingToken = await issueAuthAction({
    userId: user.id,
    purpose: "sensitive_change",
    sessionId: await currentSessionId(supabase),
  });
  const redirectTo = authCallbackUrl("reauthenticate");

  if (method === "oauth") {
    const { data, error } = await supabase.auth.signInWithOAuth(
      // `prompt=select_account consent`: reauthentication has to be a
      // deliberate act, not a silent redirect the user never sees.
      googleOAuthOptions(redirectTo, true),
    );
    if (error || !data?.url) {
      throw new ApiError(400, "reauthentication_unavailable", "Try again in a moment.");
    }
    return { method, redirectUrl: data.url, pendingToken };
  }

  if (!user.email) {
    throw new ApiError(409, "reauthentication_unavailable", "This account cannot be verified.");
  }
  // Existing user only: this is a proof-of-identity link, never a signup.
  await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  return { method, pendingToken };
}

/**
 * Starts the step-up a Google or passwordless account needs before deletion.
 *
 * The `sensitive_change` challenge is minted *here*, before the user leaves
 * for the provider, and the cookie carries it across the round trip. The
 * callback then compares the identity that comes back against the identity
 * recorded in that challenge — without which, authenticating as any account at
 * the provider would satisfy a deletion started by a different one.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const { supabase, user } = await requireSensitiveAction();
    await enforceAuthRateLimit(request, "reauthentication", { userId: user.id });

    const started = await startDeletionReauthentication(supabase, user);
    return setAuthActionCookie(
      ok(
        { method: started.method, redirect_url: started.redirectUrl ?? null },
        { headers: { "Cache-Control": "no-store" } },
      ),
      started.pendingToken,
    );
  } catch (error) {
    return routeError(error);
  }
}
