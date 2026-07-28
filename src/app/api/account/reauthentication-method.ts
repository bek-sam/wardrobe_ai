import type { User } from "@supabase/supabase-js";

import { hasPasswordIdentity, userIdentities } from "@/lib/auth/identities";

export type DeletionReauthMethod = "password" | "oauth" | "email_link";

/**
 * How this particular account must prove it is really them before deletion.
 *
 * The rule the previous implementation got wrong: it treated "the user has an
 * email claim" as "the user has a password", then demanded one. A Google-only
 * account has an email and no password, so those users could never delete
 * their account at all. Only an `email` *identity* means a password exists.
 *
 * Everyone else proves identity through a provider round trip — Google for
 * linked accounts, a one-time email link for passwordless ones — which is why
 * the return leg is bound to a challenge rather than trusted on its own.
 */
export function deletionReauthMethod(user: User): DeletionReauthMethod {
  const identities = userIdentities(user);
  if (hasPasswordIdentity(identities)) return "password";
  if (identities.some((identity) => identity.provider === "google")) return "oauth";
  return "email_link";
}
