import { createAdminClient } from "@/lib/supabase/admin";

import { processStorageDeletionTask } from "./process-task";
import type { StorageDeletionTask } from "./types";

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
    const succeeded = await processStorageDeletionTask(admin, task);
    if (succeeded) completed += 1;
    else failed += 1;
  }

  return { claimed: tasks.length, completed, failed };
}
