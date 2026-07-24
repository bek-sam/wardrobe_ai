import type { SupabaseClient } from "@supabase/supabase-js";

import { assertOwnedStoragePath } from "@/lib/storage/private-images";

import { retryAt } from "./retry-at";
import type { StorageDeletionTask } from "./types";

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

    const { error: updateError } = await admin
      .from("storage_deletion_queue")
      .update({
        status: "complete",
        locked_until: null,
        next_attempt_at: new Date().toISOString(),
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("status", "processing");
    if (updateError) throw updateError;
    return true;
  } catch {
    await admin
      .from("storage_deletion_queue")
      .update({
        status: "failed",
        locked_until: null,
        next_attempt_at: retryAt(task.attempt_count),
        error_message: "Private object cleanup could not be completed.",
        completed_at: null,
      })
      .eq("id", task.id)
      .eq("status", "processing");
    return false;
  }
}
