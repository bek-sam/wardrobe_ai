import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  insertWardrobeItem,
  type TestUser,
} from "./helpers";

const admin = createAdminClient();
let userA: TestUser;
let userB: TestUser;

beforeAll(async () => {
  [userA, userB] = await Promise.all([createTestUser(admin), createTestUser(admin)]);
});

afterAll(async () => {
  await Promise.all([deleteTestUser(admin, userA.id), deleteTestUser(admin, userB.id)]);
});

describe("RLS: wardrobe-compilation tables", () => {
  it("lets a user read their own wardrobe_compilation_state row", async () => {
    // A fresh user has no row until the first dirty-marking trigger fires;
    // insert an item to trigger it, then confirm the owner can read it back.
    await insertWardrobeItem(admin, userA.id);
    const { data, error } = await userA.client
      .from("wardrobe_compilation_state")
      .select("user_id")
      .eq("user_id", userA.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(userA.id);
  });

  it("never returns another user's wardrobe_compilation_state row", async () => {
    const { data, error } = await userB.client
      .from("wardrobe_compilation_state")
      .select("user_id")
      .eq("user_id", userA.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("never returns another user's wardrobe_compilation_jobs rows", async () => {
    const { data, error } = await userB.client
      .from("wardrobe_compilation_jobs")
      .select("id")
      .eq("user_id", userA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("blocks a signed-in user from writing directly to outfit_candidates", async () => {
    const { error } = await userA.client.from("outfit_candidates").insert({
      user_id: userA.id,
      combination_key: "manual-insert-attempt",
      compiled_wardrobe_version: "v1",
      total_score: 0.5,
    });
    // Only service-role writes are granted; a direct authenticated insert
    // must be rejected (RLS denies all authenticated writes on this table).
    expect(error).not.toBeNull();
  });

  it("blocks a signed-in user from writing directly to wardrobe_compilation_jobs", async () => {
    const { error } = await userA.client.from("wardrobe_compilation_jobs").insert({
      user_id: userA.id,
      status: "queued",
      trigger_reason: "manual",
    });
    expect(error).not.toBeNull();
  });
});

describe("request_wardrobe_recompilation()", () => {
  it("queues a job for a dirty/never-compiled user", async () => {
    const { data, error } = await userA.client.rpc("request_wardrobe_recompilation");
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "queued" });
    expect(typeof (data as { job_id: string }).job_id).toBe("string");
  });

  it("debounces: a second call while the job is still queued reports already_running", async () => {
    const { data, error } = await userA.client.rpc("request_wardrobe_recompilation");
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "already_running" });
  });

  it("never creates a second queued/running row for the same user (unique partial index)", async () => {
    const { data, error } = await admin
      .from("wardrobe_compilation_jobs")
      .select("id")
      .eq("user_id", userA.id)
      .in("status", ["queued", "running"]);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("reports up_to_date once the outstanding job is completed and the user isn't dirty", async () => {
    const { data: activeJob } = await admin
      .from("wardrobe_compilation_jobs")
      .select("id")
      .eq("user_id", userA.id)
      .in("status", ["queued", "running"])
      .single();

    await admin
      .from("wardrobe_compilation_jobs")
      .update({ status: "complete" })
      .eq("id", (activeJob as { id: string }).id);
    await admin
      .from("wardrobe_compilation_state")
      .update({ dirty_since: null, compiled_wardrobe_version: "v1" })
      .eq("user_id", userA.id);

    const { data, error } = await userA.client.rpc("request_wardrobe_recompilation");
    expect(error).toBeNull();
    expect(data).toEqual({ status: "up_to_date", job_id: null });
  });

  it("rate-limits repeated manual recompilation (PT429) after the bucket is exhausted", async () => {
    // consume_rate_limit's bucket ('wardrobe_recompile_manual', limit 5 per
    // 10 minutes) is keyed by user, not by job state, so re-dirtying and
    // re-completing a job 6 times over exercises the real limiter instead of
    // just the debounce branch.
    let rateLimited = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await admin
        .from("wardrobe_compilation_state")
        .update({ dirty_since: new Date().toISOString() })
        .eq("user_id", userA.id);

      const { data, error } = await userA.client.rpc("request_wardrobe_recompilation");
      if (error) {
        expect(error.code).toBe("PT429");
        rateLimited = true;
        break;
      }
      const jobId = (data as { job_id: string | null }).job_id;
      if (jobId) {
        await admin
          .from("wardrobe_compilation_jobs")
          .update({ status: "complete" })
          .eq("id", jobId);
      }
    }
    expect(rateLimited).toBe(true);
  });
});
