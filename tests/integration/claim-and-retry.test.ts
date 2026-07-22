import { afterAll, describe, expect, it } from "vitest";

import { createAdminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

const admin = createAdminClient();
const createdUserIds: string[] = [];

async function freshUser(): Promise<TestUser> {
  const user = await createTestUser(admin);
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  await Promise.all(createdUserIds.map((id) => deleteTestUser(admin, id)));
});

async function insertQueuedJob(userId: string) {
  const { data, error } = await admin
    .from("wardrobe_compilation_jobs")
    .insert({ user_id: userId, status: "queued", trigger_reason: "item_change" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to insert a queued job.");
  return (data as { id: string }).id;
}

describe("claim_wardrobe_compilation_jobs(): FOR UPDATE SKIP LOCKED batch claim", () => {
  it("never lets two concurrent claims return the same job", async () => {
    // Each test uses its own fresh users: the (user_id) partial unique index
    // on active jobs means a user can only ever have one queued/running job,
    // so job state must never carry over between tests.
    const testUsers = await Promise.all([freshUser(), freshUser(), freshUser()]);
    const jobIds = await Promise.all(testUsers.map((user) => insertQueuedJob(user.id)));

    const [first, second] = await Promise.all([
      admin.rpc("claim_wardrobe_compilation_jobs", { p_limit: 2, p_lease_seconds: 300 }),
      admin.rpc("claim_wardrobe_compilation_jobs", { p_limit: 2, p_lease_seconds: 300 }),
    ]);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const claimedIds = [...(first.data as { id: string }[]), ...(second.data as { id: string }[])]
      .map((row) => row.id)
      .filter((id) => jobIds.includes(id));

    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(claimedIds.length).toBeLessThanOrEqual(jobIds.length);
    expect(claimedIds.length).toBeGreaterThan(0);

    const { data: claimedRows } = await admin
      .from("wardrobe_compilation_jobs")
      .select("id, status, locked_until")
      .in("id", claimedIds);
    for (const row of claimedRows ?? []) {
      expect(row.status).toBe("running");
      expect(new Date(row.locked_until as string).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("fails a job that exceeded its retry budget to retry_exhausted instead of reclaiming it", async () => {
    const user = await freshUser();
    const { data: inserted, error: insertError } = await admin
      .from("wardrobe_compilation_jobs")
      .insert({
        user_id: user.id,
        status: "failed",
        trigger_reason: "item_change",
        attempt_count: 5,
        next_attempt_at: new Date(Date.now() - 60_000).toISOString(),
        locked_until: null,
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    const jobId = (inserted as { id: string }).id;

    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_wardrobe_compilation_jobs",
      { p_limit: 10, p_lease_seconds: 300 },
    );
    expect(claimError).toBeNull();
    expect((claimed as { id: string }[]).some((row) => row.id === jobId)).toBe(false);

    const { data: finalRow } = await admin
      .from("wardrobe_compilation_jobs")
      .select("status, error_code")
      .eq("id", jobId)
      .single();
    expect(finalRow?.status).toBe("failed");
    expect(finalRow?.error_code).toBe("retry_exhausted");
  });

  it("reclaims a job whose lease has expired", async () => {
    const user = await freshUser();
    const jobId = await insertQueuedJob(user.id);
    const { error: claimError } = await admin.rpc("claim_wardrobe_compilation_jobs", {
      p_limit: 10,
      p_lease_seconds: 300,
    });
    expect(claimError).toBeNull();

    // Simulate a crashed worker: force the lease into the past instead of
    // waiting out a real 300s lease.
    await admin
      .from("wardrobe_compilation_jobs")
      .update({ locked_until: new Date(Date.now() - 1_000).toISOString() })
      .eq("id", jobId);

    const { data: reclaimed, error: reclaimError } = await admin.rpc(
      "claim_wardrobe_compilation_jobs",
      { p_limit: 10, p_lease_seconds: 300 },
    );
    expect(reclaimError).toBeNull();
    expect((reclaimed as { id: string }[]).some((row) => row.id === jobId)).toBe(true);
  });
});
