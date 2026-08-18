import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const MAX_STORAGE_DELETION_ATTEMPTS = 8;
const PRIVATE_BUCKETS = new Set([
  "wardrobe-originals",
  "wardrobe-items",
  "wardrobe-labels",
  "wardrobe-generated",
  "profile-references",
]);

export interface StorageDeletionTask {
  id: string;
  user_id: string;
  bucket_id: string;
  storage_path: string;
  attempt_count: number;
}

export interface StorageDeletionBatchResult {
  claimed: number;
  completed: number;
  failed: number;
}

export function retryAt(attemptCount: number, now = Date.now()): string {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(now + delaySeconds * 1_000).toISOString();
}

function assertDeletionTarget(task: StorageDeletionTask): void {
  if (!PRIVATE_BUCKETS.has(task.bucket_id)) throw new Error("Unrecognized private bucket.");
  if (
    !task.storage_path.startsWith(`${task.user_id}/`) ||
    task.storage_path.includes("..") ||
    task.storage_path.includes("\\")
  ) {
    throw new Error("Storage path is outside the owning user's prefix.");
  }
}

/** Removes bytes before the database RPC is allowed to mark a task complete. */
export async function processStorageDeletionTask(
  admin: SupabaseClient,
  task: StorageDeletionTask,
): Promise<boolean> {
  try {
    assertDeletionTarget(task);
    const { error: removalError } = await admin.storage
      .from(task.bucket_id)
      .remove([task.storage_path]);
    if (removalError) throw removalError;

    const { error } = await admin.rpc("complete_storage_deletion_task", { p_task_id: task.id });
    if (error) throw error;
    return true;
  } catch {
    // The RPC dead-letters after the bounded attempt budget and keeps the
    // parent account deletion visibly incomplete for operator repair.
    await admin.rpc("fail_storage_deletion_task", {
      p_task_id: task.id,
      p_next_attempt_at: retryAt(task.attempt_count),
      p_max_attempts: MAX_STORAGE_DELETION_ATTEMPTS,
    });
    return false;
  }
}

export async function processStorageDeletionBatch(
  admin: SupabaseClient,
  limit = 20,
): Promise<StorageDeletionBatchResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Storage deletion batch limit must be between 1 and 100.");
  }
  const { data, error } = await admin.rpc("claim_storage_deletion_tasks", {
    p_limit: limit,
    p_lease_seconds: 300,
  });
  if (error) throw error;

  const tasks = (Array.isArray(data) ? data : data ? [data] : []) as StorageDeletionTask[];
  let completed = 0;
  let failed = 0;
  for (const task of tasks) {
    if (await processStorageDeletionTask(admin, task)) completed += 1;
    else failed += 1;
  }
  return { claimed: tasks.length, completed, failed };
}

export function createStorageAdminClient(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const url = environment.SUPABASE_URL;
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
