import { createAdminClient } from "@/lib/supabase/admin";
import { assertOwnedStoragePath } from "@/lib/storage/private-images";

type StorageDeletionTask = {
  id: string;
  user_id: string;
  bucket_id: string;
  storage_path: string;
  attempt_count: number;
};

function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}

export async function processStorageDeletionBatch(limit = 20) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_storage_deletion_tasks", {
    p_limit: limit,
    p_lease_seconds: 300,
  });
  if (error) throw error;

  const tasks = (Array.isArray(data) ? data : data ? [data] : []) as StorageDeletionTask[];
  let completed = 0;
  let failed = 0;

  for (const task of tasks) {
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
      completed += 1;
    } catch {
      failed += 1;
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
    }
  }

  return { claimed: tasks.length, completed, failed };
}
