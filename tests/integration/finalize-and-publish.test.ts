import { afterAll, describe, expect, it } from "vitest";

import { createAdminClient, createTestUser, deleteTestUser, insertWardrobeItem } from "./helpers";

const admin = createAdminClient();
const createdUserIds: string[] = [];

async function freshUserWithWardrobe() {
  const user = await createTestUser(admin);
  createdUserIds.push(user.id);
  const top = await insertWardrobeItem(admin, user.id, { layer_role: "top" });
  const bottom = await insertWardrobeItem(admin, user.id, {
    layer_role: "bottom",
    category: "bottoms",
  });
  return { user, top, bottom };
}

afterAll(async () => {
  await Promise.all(createdUserIds.map((id) => deleteTestUser(admin, id)));
});

// Deliberately the same key across versions in most tests below (never
// version-qualified) -- outfit_candidates is unique on (user_id,
// compiled_wardrobe_version, combination_key), so the same combination_key
// reappearing under a new version must insert a new row, not collide with
// the prior version's row.
//
// Inserting a wardrobe item already auto-creates a queued job via the
// mark_wardrobe_compilation_dirty trigger (the partial unique index allows
// only one queued/running job per user), so this reuses that row rather than
// inserting a second one, which would violate the index.
async function activeJobIdFor(userId: string) {
  const { data, error } = await admin
    .from("wardrobe_compilation_jobs")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (error) throw error;
  if (data) return (data as { id: string }).id;

  const { data: inserted, error: insertError } = await admin
    .from("wardrobe_compilation_jobs")
    .insert({ user_id: userId, status: "queued", trigger_reason: "manual" })
    .select("id")
    .single();
  if (insertError || !inserted) throw insertError ?? new Error("Failed to insert job.");
  return (inserted as { id: string }).id;
}

async function claimAJob(userId: string) {
  const jobId = await activeJobIdFor(userId);
  const { error } = await admin
    .from("wardrobe_compilation_jobs")
    .update({
      status: "running",
      locked_at: new Date().toISOString(),
      locked_until: new Date(Date.now() + 300_000).toISOString(),
      attempt_count: 1,
    })
    .eq("id", jobId);
  if (error) throw error;
  return jobId;
}

async function writeOneCandidate(
  userId: string,
  jobId: string,
  version: string,
  topId: string,
  bottomId: string,
) {
  const { data: candidate, error: candidateError } = await admin
    .from("outfit_candidates")
    .insert({
      user_id: userId,
      combination_key: `${topId}:${bottomId}`,
      compiled_wardrobe_version: version,
      job_id: jobId,
      status: "active",
      total_score: 0.7,
    })
    .select("id")
    .single();
  if (candidateError || !candidate) throw candidateError ?? new Error("candidate insert failed");
  const candidateId = (candidate as { id: string }).id;

  const { error: itemsError } = await admin.from("outfit_candidate_items").insert([
    { candidate_id: candidateId, item_id: topId, user_id: userId, role: "top", sort_order: 0 },
    {
      candidate_id: candidateId,
      item_id: bottomId,
      user_id: userId,
      role: "bottom",
      sort_order: 1,
    },
  ]);
  if (itemsError) throw itemsError;
  return candidateId;
}

async function pendingChangeCount(userId: string) {
  const { data } = await admin
    .from("wardrobe_compilation_state")
    .select("pending_change_count")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.pending_change_count as number | undefined) ?? 0;
}

describe("finalize_wardrobe_compilation(): atomic publish", () => {
  it("publishes a version, updates state, and archives the prior active version", async () => {
    const { user, top, bottom } = await freshUserWithWardrobe();
    const startCount = await pendingChangeCount(user.id);

    const jobId1 = await claimAJob(user.id);
    const v1 = `v1-${jobId1}`;
    const candidateV1 = await writeOneCandidate(user.id, jobId1, v1, top.id, bottom.id);
    const { data: result1, error: error1 } = await admin.rpc("finalize_wardrobe_compilation", {
      p_job_id: jobId1,
      p_user_id: user.id,
      p_new_version: v1,
      p_start_change_count: startCount,
      p_candidate_count: 1,
      p_items_considered: 2,
    });
    expect(error1).toBeNull();
    expect(result1).toMatchObject({ published: true, changed_during_run: false });

    const { data: stateAfterV1 } = await admin
      .from("wardrobe_compilation_state")
      .select("compiled_wardrobe_version, dirty_since")
      .eq("user_id", user.id)
      .single();
    expect(stateAfterV1?.compiled_wardrobe_version).toBe(v1);
    expect(stateAfterV1?.dirty_since).toBeNull();

    // Publish a second version: the first version's candidate must be
    // archived, never deleted outright, once the new one is live.
    const startCount2 = await pendingChangeCount(user.id);
    const jobId2 = await claimAJob(user.id);
    const v2 = `v2-${jobId2}`;
    await writeOneCandidate(user.id, jobId2, v2, top.id, bottom.id);
    const { error: error2 } = await admin.rpc("finalize_wardrobe_compilation", {
      p_job_id: jobId2,
      p_user_id: user.id,
      p_new_version: v2,
      p_start_change_count: startCount2,
      p_candidate_count: 1,
      p_items_considered: 2,
    });
    expect(error2).toBeNull();

    const { data: v1CandidateAfter } = await admin
      .from("outfit_candidates")
      .select("status")
      .eq("id", candidateV1)
      .single();
    expect(v1CandidateAfter?.status).toBe("archived");

    const { data: stateAfterV2 } = await admin
      .from("wardrobe_compilation_state")
      .select("compiled_wardrobe_version")
      .eq("user_id", user.id)
      .single();
    expect(stateAfterV2?.compiled_wardrobe_version).toBe(v2);
  });

  it("rejects finalization when the actual candidate count doesn't match what was claimed", async () => {
    const { user, top, bottom } = await freshUserWithWardrobe();
    const startCount = await pendingChangeCount(user.id);
    const jobId = await claimAJob(user.id);
    const version = `mismatch-${jobId}`;
    await writeOneCandidate(user.id, jobId, version, top.id, bottom.id);

    const { error } = await admin.rpc("finalize_wardrobe_compilation", {
      p_job_id: jobId,
      p_user_id: user.id,
      p_new_version: version,
      p_start_change_count: startCount,
      p_candidate_count: 2, // only 1 was actually written
      p_items_considered: 2,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/candidate_count_mismatch/);
  });

  it("rejects finalization when the job isn't running under a live lease", async () => {
    const { user, top, bottom } = await freshUserWithWardrobe();
    const startCount = await pendingChangeCount(user.id);
    // Left as the auto-created 'queued' job (never claimed/running).
    const jobId = await activeJobIdFor(user.id);
    const version = `unleased-${jobId}`;
    await writeOneCandidate(user.id, jobId, version, top.id, bottom.id);

    const { error } = await admin.rpc("finalize_wardrobe_compilation", {
      p_job_id: jobId,
      p_user_id: user.id,
      p_new_version: version,
      p_start_change_count: startCount,
      p_candidate_count: 1,
      p_items_considered: 2,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not_leased/);
  });

  it("leaves the prior valid library untouched when a compile run is never finalized", async () => {
    const { user, top, bottom } = await freshUserWithWardrobe();
    const startCount = await pendingChangeCount(user.id);
    const jobId1 = await claimAJob(user.id);
    const v1 = `stable-${jobId1}`;
    await writeOneCandidate(user.id, jobId1, v1, top.id, bottom.id);
    await admin.rpc("finalize_wardrobe_compilation", {
      p_job_id: jobId1,
      p_user_id: user.id,
      p_new_version: v1,
      p_start_change_count: startCount,
      p_candidate_count: 1,
      p_items_considered: 2,
    });

    // A second run starts, writes its (unpublished) candidates, then "crashes"
    // -- finalize is never called. The state pointer must still be v1, and
    // v1's candidates must still be active/servable.
    const jobId2 = await claimAJob(user.id);
    const v2 = `crashed-${jobId2}`;
    await writeOneCandidate(user.id, jobId2, v2, top.id, bottom.id);

    const { data: state } = await admin
      .from("wardrobe_compilation_state")
      .select("compiled_wardrobe_version")
      .eq("user_id", user.id)
      .single();
    expect(state?.compiled_wardrobe_version).toBe(v1);

    const { data: v1Candidates } = await admin
      .from("outfit_candidates")
      .select("status")
      .eq("user_id", user.id)
      .eq("compiled_wardrobe_version", v1);
    expect(v1Candidates?.every((row) => row.status === "active")).toBe(true);
  });

  it("keeps dirty_since set and queues a follow-up job when a change lands mid-run", async () => {
    const { user, top, bottom } = await freshUserWithWardrobe();
    const startCount = await pendingChangeCount(user.id);
    const jobId = await claimAJob(user.id);
    const version = `midrun-change-${jobId}`;
    await writeOneCandidate(user.id, jobId, version, top.id, bottom.id);

    // A wardrobe edit lands while the job is "running": the dirty-marking
    // trigger increments pending_change_count and sets dirty_since. The
    // trigger's own job-insert no-ops (this user already has a running job).
    await insertWardrobeItem(admin, user.id, { layer_role: "accessory", category: "accessories" });

    const { data: result, error } = await admin.rpc("finalize_wardrobe_compilation", {
      p_job_id: jobId,
      p_user_id: user.id,
      p_new_version: version,
      p_start_change_count: startCount,
      p_candidate_count: 1,
      p_items_considered: 2,
    });
    expect(error).toBeNull();
    expect(result).toMatchObject({ published: true, changed_during_run: true });

    const { data: state } = await admin
      .from("wardrobe_compilation_state")
      .select("dirty_since, compiled_wardrobe_version")
      .eq("user_id", user.id)
      .single();
    // The version still publishes (it's safe: retrieval re-validates item
    // ownership/availability per request) but dirty_since survives the
    // compare-and-swap instead of being cleared.
    expect(state?.compiled_wardrobe_version).toBe(version);
    expect(state?.dirty_since).not.toBeNull();

    const { data: followUpJobs } = await admin
      .from("wardrobe_compilation_jobs")
      .select("id, status, trigger_reason")
      .eq("user_id", user.id)
      .in("status", ["queued", "running"]);
    expect(followUpJobs?.length).toBe(1);
    expect(followUpJobs?.[0]?.trigger_reason).toBe("item_change");
  });
});
