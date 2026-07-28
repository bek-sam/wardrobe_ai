import { createClient } from "@supabase/supabase-js";

import { requireEnvironment } from "@/lib/env/server";

/**
 * Verifies a password without disturbing the caller's session.
 *
 * The obvious implementation — calling `signInWithPassword` on the request's
 * own Supabase client — succeeds but rewrites the session cookies as a side
 * effect, so a wrong password taken mid-flow can leave the user in a confusing
 * half-signed-in state. This uses a throwaway client with no persistence, so
 * the check is pure: it answers yes or no and touches nothing.
 *
 * The password is passed straight through and is never logged, trimmed, or
 * normalized.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const environment = requireEnvironment(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );

  const client = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const { error } = await client.auth.signInWithPassword({ email, password });
  // Drops the short-lived session this check created from the throwaway
  // client. Scoped to `local` on purpose: a global sign-out here would revoke
  // the user's real sessions as a side effect of typing their own password.
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);

  return !error;
}
