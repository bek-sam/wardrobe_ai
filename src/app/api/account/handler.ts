import type { SupabaseClient } from "@supabase/supabase-js";

import { deleteAuthUser } from "./delete-auth-user";
import { startDeletion } from "./start-deletion";
import { verifyDeletionRequest } from "./verify-deletion-request";

/**
 * Deletion is two decoupled, retryable steps instead of one long synchronous
 * request: start_account_deletion() durably records the request and enqueues
 * every owned Storage object into the existing storage_deletion_queue (the
 * same queue wardrobe-image/import cleanup already uses), which the existing
 * background worker drains with its own retries. Only then is the Auth user
 * deleted through the Admin API. A crash between those two steps leaves a
 * `deleting_auth_user` row that a retried DELETE call resumes from, instead of
 * silently losing track of a partially completed deletion.
 */
export async function handleDeleteAccount(
  supabase: SupabaseClient,
  viewer: { id: string; email?: string | null },
  confirmation: string,
  password: string,
) {
  await verifyDeletionRequest(supabase, viewer, confirmation, password);
  const deletionRequest = await startDeletion(supabase, viewer.id);
  await deleteAuthUser(supabase, viewer.id);

  return {
    deleted: true,
    user_id: viewer.id,
    storage_objects_queued: deletionRequest.storage_objects_total,
  };
}
