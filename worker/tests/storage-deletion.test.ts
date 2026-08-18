import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_STORAGE_DELETION_ATTEMPTS,
  processStorageDeletionBatch,
  processStorageDeletionTask,
  retryAt,
} from "../src/handlers/storage-deletion.js";

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
  rpc.mockResolvedValue({ data: { updated: true }, error: null });
});

describe("storage deletion handler", () => {
  it("removes private bytes before finalizing the database task", async () => {
    expect(await processStorageDeletionTask(admin(), task())).toBe(true);
    expect(remove).toHaveBeenCalledWith([`${USER_ID}/coat.webp`]);
    expect(rpc).toHaveBeenCalledWith("complete_storage_deletion_task", {
      p_task_id: task().id,
    });
    expect(remove.mock.invocationCallOrder[0]!).toBeLessThan(rpc.mock.invocationCallOrder[0]!);
  });

  it("rejects foreign paths and unexpected buckets before touching Storage", async () => {
    expect(
      await processStorageDeletionTask(admin(), task({ storage_path: "other-user/secret.webp" })),
    ).toBe(false);
    expect(await processStorageDeletionTask(admin(), task({ bucket_id: "public-assets" }))).toBe(
      false,
    );
    expect(remove).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("fail_storage_deletion_task", expect.anything());
  });

  it("never marks a failed removal or finalize operation complete", async () => {
    remove.mockResolvedValueOnce({ error: { message: "bucket unavailable" } });
    expect(await processStorageDeletionTask(admin(), task())).toBe(false);
    expect(rpc).not.toHaveBeenCalledWith("complete_storage_deletion_task", expect.anything());

    remove.mockResolvedValueOnce({ error: null });
    rpc.mockImplementation((name: string) =>
      name === "complete_storage_deletion_task"
        ? Promise.resolve({ data: null, error: { message: "deadlock" } })
        : Promise.resolve({ data: null, error: null }),
    );
    expect(await processStorageDeletionTask(admin(), task())).toBe(false);
    expect(rpc).toHaveBeenCalledWith("fail_storage_deletion_task", expect.anything());
  });

  it("claims and accounts for a bounded batch", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "claim_storage_deletion_tasks") return { data: [task()], error: null };
      return { data: null, error: null };
    });

    await expect(processStorageDeletionBatch(admin(), 10)).resolves.toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
    });
    expect(rpc).toHaveBeenCalledWith("claim_storage_deletion_tasks", {
      p_limit: 10,
      p_lease_seconds: 300,
    });
  });

  it("uses capped exponential retry delays and an eight-attempt budget", () => {
    const now = Date.parse("2026-08-12T00:00:00Z");
    const delay = (attempt: number) => Date.parse(retryAt(attempt, now)) - now;
    expect(delay(1)).toBe(30_000);
    expect(delay(3)).toBe(120_000);
    expect(delay(20)).toBe(3_600_000);
    expect(
      Array.from({ length: MAX_STORAGE_DELETION_ATTEMPTS }, (_, index) => delay(index + 1)).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBeGreaterThan(60 * 60 * 1_000);
  });
});
