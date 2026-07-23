import { requestJson } from "@/lib/api/request";

import type { Notice, Profile } from "./settings.types";

export async function deleteAccountRequest(
  profile: Profile,
  deletePassword: string,
): Promise<void> {
  await requestJson<{ deleted: true }>("/api/account", {
    method: "DELETE",
    body: JSON.stringify({ confirmation: profile.id, password: deletePassword }),
  });
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
