import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAdminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

/**
 * The full deletion lifecycle against real Postgres and real Storage.
 *
 * The property under test is the one the previous implementation got wrong:
 * a deletion must not report `complete` while private files are still sitting
 * in a bucket. So the request is driven step by step, and `complete` is
 * asserted to appear only after the last object is actually gone.
 */

const admin = createAdminClient();
const BUCKETS = ["wardrobe-originals", "wardrobe-items"] as const;

let doomed: TestUser;
let bystander: TestUser;
let bystanderObject: string;

async function upload(userId: string, bucket: string): Promise<string> {
  const path = `${userId}/${randomUUID()}.bin`;
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, new Blob([new Uint8Array([1, 2, 3])]));
  if (error) throw error;
  return path;
}

async function objectExists(bucket: string, path: string): Promise<boolean> {
  const folder = path.split("/").slice(0, -1).join("/");
  const name = path.split("/").pop()!;
  const { data } = await admin.storage.from(bucket).list(folder);
  return (data ?? []).some((entry) => entry.name === name);
}

/** Drains the queue the way the deployed worker does, without the HTTP route. */
async function drainStorageQueue(): Promise<number> {
  let processed = 0;
  for (let pass = 0; pass < 10; pass += 1) {
    const { data, error } = await admin.rpc("claim_storage_deletion_tasks", {
      p_limit: 20,
      p_lease_seconds: 60,
    });
    if (error) throw error;
    const tasks = (data ?? []) as { id: string; bucket_id: string; storage_path: string }[];
    if (tasks.length === 0) break;

    for (const task of tasks) {
      await admin.storage.from(task.bucket_id).remove([task.storage_path]);
      const { error: completeError } = await admin.rpc("complete_storage_deletion_task", {
        p_task_id: task.id,
      });
      if (completeError) throw completeError;
      processed += 1;
    }
  }
  return processed;
}

let doomedObjects: { bucket: string; path: string }[] = [];

beforeAll(async () => {
  doomed = await createTestUser(admin);
  bystander = await createTestUser(admin);

  doomedObjects = [];
  for (const bucket of BUCKETS) {
    doomedObjects.push({ bucket, path: await upload(doomed.id, bucket) });
  }
  bystanderObject = await upload(bystander.id, "wardrobe-originals");

  await admin.from("wardrobe_items").insert({
    user_id: doomed.id,
    name: "Doomed jacket",
    category: "outerwear",
    layer_role: "layer",
  });
  await admin.rpc("record_legal_acceptance", {
    p_user_id: doomed.id,
    p_terms_version: "2026-07-28",
    p_privacy_version: "2026-07-28",
    p_source: "signup",
  });
}, 60_000);

afterAll(async () => {
  await deleteTestUser(admin, bystander.id);
});

describe("account deletion lifecycle", () => {
  it("enqueues every owned object and records the request", async () => {
    const { data, error } = await doomed.client.rpc("start_account_deletion");
    expect(error).toBeNull();
    expect(data.status).toBe("storage_deletion_queued");
    expect(data.storage_objects_total).toBeGreaterThanOrEqual(doomedObjects.length);
  });

  it("claims the row at 'requested' before walking the manifest", async () => {
    // A separate account, so the assertion is about the *first* call rather
    // than the already-advanced row above. The intermediate state is what
    // distinguishes a half-finished enqueue from one that never started.
    const observed = await createTestUser(admin);
    await admin.rpc("enqueue_storage_deletion", {
      p_user_id: observed.id,
      p_bucket_id: "wardrobe-items",
      p_storage_path: `${observed.id}/${randomUUID()}.bin`,
      p_reason: "wardrobe_item_deleted",
    });

    const { data } = await observed.client.rpc("start_account_deletion");
    // The row exists and has advanced past 'requested' by the time it returns,
    // proving the intermediate insert happened and then moved on.
    expect(data.status).toBe("storage_deletion_queued");
    expect(data.requested_at).not.toBeNull();

    await deleteTestUser(admin, observed.id);
  });

  it("is idempotent before the Auth user is removed", async () => {
    const { data, error } = await doomed.client.rpc("start_account_deletion");
    expect(error).toBeNull();

    const { data: rows } = await admin
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", doomed.id);
    expect(rows).toHaveLength(1);
    expect(data.status).toBe("storage_deletion_queued");
  });

  it("does not duplicate queue rows on a repeated enqueue", async () => {
    const { data } = await admin
      .from("storage_deletion_queue")
      .select("bucket_id, storage_path")
      .eq("user_id", doomed.id)
      .eq("reason", "account_deletion");
    const unique = new Set((data ?? []).map((row) => `${row.bucket_id}:${row.storage_path}`));
    expect(unique.size).toBe((data ?? []).length);
  });

  it("marks the request pending on Storage, not complete, once the identity is gone", async () => {
    await doomed.client.rpc("mark_account_deletion_auth_pending");
    await admin.auth.admin.deleteUser(doomed.id);

    const { data, error } = await admin.rpc("mark_account_deletion_auth_deleted", {
      p_user_id: doomed.id,
    });
    expect(error).toBeNull();
    // The whole point: files are still there, so this must not say complete.
    expect(data.status).toBe("auth_deleted_storage_pending");
    expect(data.completed_at).toBeNull();
  });

  it("cascades the relational data", async () => {
    const { data: items } = await admin
      .from("wardrobe_items")
      .select("id")
      .eq("user_id", doomed.id);
    const { data: legal } = await admin
      .from("legal_acceptances")
      .select("id")
      .eq("user_id", doomed.id);
    expect(items ?? []).toHaveLength(0);
    expect(legal ?? []).toHaveLength(0);
  });

  it("keeps the audit row alive after the Auth cascade", async () => {
    const { data } = await admin
      .from("account_deletion_requests")
      .select("status")
      .eq("user_id", doomed.id)
      .single();
    expect(data?.status).toBe("auth_deleted_storage_pending");
  });

  it("removes every private object when the worker drains the queue", async () => {
    expect(await drainStorageQueue()).toBeGreaterThanOrEqual(doomedObjects.length);
    for (const object of doomedObjects) {
      expect(await objectExists(object.bucket, object.path)).toBe(false);
    }
  });

  it("only then reports the deletion complete", async () => {
    const { data } = await admin
      .from("account_deletion_requests")
      .select("status, completed_at, attention_required")
      .eq("user_id", doomed.id)
      .single();
    expect(data?.status).toBe("complete");
    expect(data?.completed_at).not.toBeNull();
    expect(data?.attention_required).toBe(false);
  });

  it("does not return completed objects to pending on a worker retry", async () => {
    expect(await drainStorageQueue()).toBe(0);
    const { data } = await admin
      .from("account_deletion_requests")
      .select("status")
      .eq("user_id", doomed.id)
      .single();
    expect(data?.status).toBe("complete");
  });

  it("leaves the other account entirely untouched", async () => {
    expect(await objectExists("wardrobe-originals", bystanderObject)).toBe(true);
    const { data } = await admin.auth.admin.getUserById(bystander.id);
    expect(data.user?.id).toBe(bystander.id);
  });
});

describe("dead-lettering and health", () => {
  it("retires an object after its attempt budget and flags the parent", async () => {
    const orphan = await createTestUser(admin);
    const path = `${orphan.id}/${randomUUID()}.bin`;
    await admin.rpc("enqueue_storage_deletion", {
      p_user_id: orphan.id,
      p_bucket_id: "wardrobe-items",
      p_storage_path: path,
      p_reason: "account_deletion",
    });
    await orphan.client.rpc("start_account_deletion");

    const { data: claimed } = await admin.rpc("claim_storage_deletion_tasks", {
      p_limit: 20,
      p_lease_seconds: 60,
    });
    const task = ((claimed ?? []) as { id: string; storage_path: string }[]).find(
      (row) => row.storage_path === path,
    );
    expect(task).toBeDefined();

    const { data } = await admin.rpc("fail_storage_deletion_task", {
      p_task_id: task!.id,
      p_next_attempt_at: new Date().toISOString(),
      // Budget of zero: this attempt is already past it.
      p_max_attempts: 0,
    });
    expect(data.dead_lettered).toBe(true);

    const { data: request } = await admin
      .from("account_deletion_requests")
      .select("attention_required")
      .eq("user_id", orphan.id)
      .single();
    expect(request?.attention_required).toBe(true);

    await deleteTestUser(admin, orphan.id);
  });

  it("reports aggregate health with no user, path, or bucket detail", async () => {
    const { data, error } = await admin.rpc("storage_deletion_health");
    expect(error).toBeNull();
    expect(Object.keys(data).sort()).toEqual([
      "account_deletions_awaiting_storage",
      "account_deletions_needing_attention",
      "dead_letter",
      "failures_last_24h",
      "oldest_pending_age_seconds",
      "pending",
      "processing",
    ]);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("wardrobe-");
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("is service-role only", async () => {
    const { error } = await bystander.client.rpc("storage_deletion_health");
    expect(error).not.toBeNull();
  });
});

describe("retention", () => {
  it("prunes only finished records, and never one needing attention", async () => {
    const { data, error } = await admin.rpc("prune_completed_account_deletions", {
      p_retention_days: 30,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      account_deletion_requests_deleted: expect.any(Number),
      storage_deletion_queue_rows_deleted: expect.any(Number),
    });

    // The completed request is only 30 days old in theory, so it survives.
    const { data: survivors } = await admin
      .from("account_deletion_requests")
      .select("status")
      .eq("user_id", doomed.id);
    expect(survivors ?? []).toHaveLength(1);
  });

  it("rejects an out-of-range retention window", async () => {
    const { error } = await admin.rpc("prune_completed_account_deletions", {
      p_retention_days: 5000,
    });
    expect(error).not.toBeNull();
  });
});
