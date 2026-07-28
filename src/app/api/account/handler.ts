import type { SupabaseClient, User } from "@supabase/supabase-js";

import { recordAuthEvent } from "@/lib/auth/audit";

import { deleteAuthUser } from "./delete-auth-user";
import { startDeletion } from "./start-deletion";
import { verifyDeletionRequest } from "./verify-deletion-request";

/**
 * Deletion is decoupled, retryable steps rather than one long request:
 * `start_account_deletion()` durably records the request and enqueues every
 * owned Storage object onto the queue the background worker already drains,
 * and only then is the Auth user removed through the Admin API. A crash
 * between those steps leaves a `deleting_auth_user` row that a retried call
 * resumes from, instead of losing track of a half-finished deletion.
 *
 * What the caller is told is now precise. `storage_complete: false` means the
 * account is unreachable and its rows are gone, while its private files are
 * still being removed in the background — which is the truth, and is what the
 * confirmation screen says.
 */
export async function handleDeleteAccount(
  supabase: SupabaseClient,
  user: User,
  confirmation: string,
  password: string,
) {
  await verifyDeletionRequest(user, confirmation, password);
  await recordAuthEvent({ type: "deletion_requested", result: "success", userId: user.id });

  const deletionRequest = await startDeletion(supabase, user.id);
  const status = await deleteAuthUser(supabase, user.id);

  return {
    deleted: true,
    user_id: user.id,
    status,
    storage_objects_queued: deletionRequest.storage_objects_total,
    storage_complete: status === "complete",
  };
}
