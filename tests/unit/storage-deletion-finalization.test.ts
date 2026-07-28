import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_STORAGE_DELETION_ATTEMPTS } from "@/jobs/process-storage-deletions/limits.data";
import { processStorageDeletionTask } from "@/jobs/process-storage-deletions/process-task";
import { retryAt } from "@/jobs/process-storage-deletions/retry-at";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const remove = vi.fn();
const rpc = vi.fn();

function admin(): SupabaseClient {
  return { storage: { from: () => ({ remove }) }, rpc } as unknown as SupabaseClient;
}

const task = (overrides: Record<string, unknown> = {}) => ({
  id: "33333333-3333-4333-8333-333333333333",
  user_id: USER_ID,
  bucket_id: "wardrobe-items",
  storage_path: `${USER_ID}/coat.webp`,
  attempt_count: 1,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  remove.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: { updated: true, account_deletion_complete: false }, error: null });
});

describe("storage deletion task completion", () => {
  it("removes the object, then finalizes through the RPC that owns the state machine", async () => {
    expect(await processStorageDeletionTask(admin(), task())).toBe(true);
    expect(remove).toHaveBeenCalledWith([`${USER_ID}/coat.webp`]);
    expect(rpc).toHaveBeenCalledWith("complete_storage_deletion_task", {
      p_task_id: task().id,
    });
  });

  it("removes the bytes before marking anything complete", async () => {
    await processStorageDeletionTask(admin(), task());
    expect(remove.mock.invocationCallOrder[0]!).toBeLessThan(rpc.mock.invocationCallOrder[0]!);
  });

  it("refuses a path outside the owning user's prefix and never calls Storage", async () => {
    const foreign = task({ storage_path: "22222222-2222-4222-8222-222222222222/secret.webp" });
    expect(await processStorageDeletionTask(admin(), foreign)).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("fail_storage_deletion_task", expect.anything());
  });

  it("does not mark complete when the Storage removal failed", async () => {
    remove.mockResolvedValue({ error: { message: "bucket unavailable" } });
    expect(await processStorageDeletionTask(admin(), task())).toBe(false);
    expect(rpc).not.toHaveBeenCalledWith("complete_storage_deletion_task", expect.anything());
  });

  it("records a retryable failure with a backed-off next attempt and the attempt budget", async () => {
    remove.mockResolvedValue({ error: { message: "transient" } });
    await processStorageDeletionTask(admin(), task({ attempt_count: 2 }));

    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("fail_storage_deletion_task");
    expect(args.p_max_attempts).toBe(MAX_STORAGE_DELETION_ATTEMPTS);
    expect(Date.parse(args.p_next_attempt_at as string)).toBeGreaterThan(Date.now());
  });

  it("treats a failed finalize as a failed task, so the parent is never closed early", async () => {
    rpc.mockImplementation((name: string) =>
      name === "complete_storage_deletion_task"
        ? Promise.resolve({ data: null, error: { message: "deadlock" } })
        : Promise.resolve({ data: null, error: null }),
    );
    expect(await processStorageDeletionTask(admin(), task())).toBe(false);
    expect(rpc).toHaveBeenCalledWith("fail_storage_deletion_task", expect.anything());
  });

  it("leaks no bucket name or object path into the failure path", async () => {
    remove.mockResolvedValue({ error: { message: "no such object wardrobe-items/secret" } });
    await processStorageDeletionTask(admin(), task());
    const serialized = JSON.stringify(rpc.mock.calls);
    expect(serialized).not.toContain("wardrobe-items/");
    expect(serialized).not.toContain("coat.webp");
  });
});

describe("retry backoff", () => {
  it("grows with each attempt and is capped at one hour", () => {
    const at = (attempt: number) => Date.parse(retryAt(attempt)) - Date.now();
    expect(at(1)).toBeLessThan(at(3));
    expect(at(3)).toBeLessThan(at(5));
    expect(at(20)).toBeLessThanOrEqual(60 * 60 * 1000 + 1_000);
  });

  it("spans hours across the full attempt budget, so a transient outage is ridden out", () => {
    const total = Array.from(
      { length: MAX_STORAGE_DELETION_ATTEMPTS },
      (_, index) => Date.parse(retryAt(index + 1)) - Date.now(),
    ).reduce((sum, delay) => sum + delay, 0);
    expect(total).toBeGreaterThan(60 * 60 * 1000);
  });
});
