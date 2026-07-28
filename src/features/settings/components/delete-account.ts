import { requestJson } from "@/lib/api/request";

import type { Notice, Profile } from "./settings.types";

export type DeletionResult = { storage_objects_queued: number; storage_complete: boolean };

export async function deleteAccountRequest(
  profile: Profile,
  deletePassword: string,
): Promise<DeletionResult> {
  return requestJson<DeletionResult>("/api/account", {
    method: "DELETE",
    // Empty for Google-only and passwordless accounts; those authorize with
    // the one-time challenge established by the reauthentication round trip.
    body: JSON.stringify({ confirmation: profile.id, password: deletePassword }),
  });
}

/**
 * Starts the provider round trip for an account with no password. Returns a
 * URL when the user must be sent to Google, or null when a one-time email link
 * was sent instead.
 */
export async function startDeletionReauthentication(): Promise<string | null> {
  const result = await requestJson<{ method: string; redirect_url: string | null }>(
    "/api/account/reauthenticate",
    { method: "POST" },
  );
  return result.redirect_url;
}

export function confirmAccountDeletion(): boolean {
  return window.confirm(
    "Permanently delete this account, all wardrobe data, and associated private files? This cannot be undone.",
  );
}

export function deleteAccountErrorNotice(error: unknown): Notice {
  return {
    tone: "error",
    message: error instanceof Error ? error.message : "The account could not be deleted.",
  };
}
