import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/audit";
import { createAdminClient } from "@/lib/supabase/admin";

import { accountDeletionRequestSchema } from "@/app/api/_lib/schemas";

/**
 * Removes the Auth identity, then records the *honest* next state.
 *
 * The old implementation wrote 'complete' here unconditionally, while the
 * user's private images were still queued for a background worker. Now the
 * database decides: no outstanding objects means the deletion really is
 * finished, anything else means `auth_deleted_storage_pending` until the
 * worker drains the queue.
 */
export async function deleteAuthUser(supabase: SupabaseClient, userId: string) {
  const admin = createAdminClient();
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    throw new ApiError(
      500,
      "account_deletion_failed",
      "Could not delete the account. Retry deletion; private files already queued for removal are unaffected.",
    );
  }
  await recordAuthEvent({ type: "deletion_auth_user_deleted", result: "success" });

  const { data, error } = await admin.rpc("mark_account_deletion_auth_deleted", {
    p_user_id: userId,
  });
  if (error) {
    // The identity is gone either way; only the audit transition failed.
    console.error("account_deletion_state_transition_failed", { code: error.code });
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The account is already deleted; local sign-out is best-effort cleanup.
  }

  const parsed = accountDeletionRequestSchema.safeParse(data);
  return parsed.success ? parsed.data.status : "auth_deleted_storage_pending";
}
