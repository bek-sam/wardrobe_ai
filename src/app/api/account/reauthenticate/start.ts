import type { SupabaseClient, User } from "@supabase/supabase-js";

import { googleOAuthOptions } from "@/app/api/auth/oauth/google/options";
import { ApiError } from "@/lib/api/response";
import { issueAuthAction } from "@/lib/auth/action-challenges";
import { authCallbackUrl } from "@/lib/auth/app-url";
import { currentSessionId } from "@/lib/auth/session-id";

import { deletionReauthMethod, type DeletionReauthMethod } from "../reauthentication-method";

export type ReauthenticationStart = {
  method: DeletionReauthMethod;
  redirectUrl?: string;
  pendingToken: string;
};

export async function startDeletionReauthentication(
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
