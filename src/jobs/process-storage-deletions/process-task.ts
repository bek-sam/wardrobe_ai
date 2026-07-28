import type { SupabaseClient } from "@supabase/supabase-js";

import { assertOwnedStoragePath } from "@/lib/storage/private-images";

import { MAX_STORAGE_DELETION_ATTEMPTS } from "./limits.data";
import { retryAt } from "./retry-at";
import type { StorageDeletionTask } from "./types";

/**
 * Removes one private object and records the outcome through the RPCs that own
 * the state machine.
 *
 * The completion path deliberately does more than flip a status: it also asks
 * the database whether this was the *last* outstanding object of an account
 * deletion, and closes the parent request if so. Doing both in one call is
 * what makes "complete" trustworthy — a worker that dies between two separate
 * writes cannot leave an account marked fully deleted while files remain.
 */
export async function processStorageDeletionTask(
  admin: SupabaseClient,
  task: StorageDeletionTask,
): Promise<boolean> {
  try {
    assertOwnedStoragePath(task.storage_path, task.user_id);
    const { error: removalError } = await admin.storage
      .from(task.bucket_id)
      .remove([task.storage_path]);
    if (removalError) throw removalError;

    const { error } = await admin.rpc("complete_storage_deletion_task", { p_task_id: task.id });
    if (error) throw error;
    return true;
  } catch {
    // Bounded retries: once the budget is spent the row is dead-lettered so it
    // stops consuming worker capacity, and the parent account deletion is
    // flagged for an operator instead of being quietly closed.
    await admin.rpc("fail_storage_deletion_task", {
      p_task_id: task.id,
      p_next_attempt_at: retryAt(task.attempt_count),
      p_max_attempts: MAX_STORAGE_DELETION_ATTEMPTS,
    });
    return false;
  }
}
