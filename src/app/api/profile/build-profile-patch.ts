import type { z } from "zod";

import type { profileUpdateSchema } from "../_lib/schemas";

type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export function buildProfilePatch(input: ProfileUpdateInput) {
  const patch: ProfileUpdateInput & { modeled_preview_consent_at?: string | null } = { ...input };
  if (input.modeled_preview_consent === true) {
    patch.modeled_preview_consent_at = new Date().toISOString();
  } else if (input.modeled_preview_consent === false) {
    patch.modeled_preview_consent_at = null;
  }
  return patch;
}
