import { afterAll, describe, expect, it } from "vitest";

import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  insertWardrobeItem,
  type TestUser,
} from "./helpers";

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

async function seedActiveCandidate(userId: string, suffix: string) {
  const top = await insertWardrobeItem(admin, userId, { layer_role: "top" });
  const bottom = await insertWardrobeItem(admin, userId, {
    layer_role: "bottom",
    category: "bottoms",
  });
  const { data: candidate, error: candidateError } = await admin
    .from("outfit_candidates")
    .insert({
      user_id: userId,
      combination_key: `preview-consent:${suffix}:${top.id}:${bottom.id}`,
      compiled_wardrobe_version: "v1",
      status: "active",
      total_score: 0.7,
    })
    .select("id")
    .single();
  if (candidateError || !candidate) throw candidateError ?? new Error("candidate insert failed");
  const candidateId = (candidate as { id: string }).id;

  const { error: itemsError } = await admin.from("outfit_candidate_items").insert([
    { candidate_id: candidateId, item_id: top.id, user_id: userId, role: "top", sort_order: 0 },
    {
      candidate_id: candidateId,
      item_id: bottom.id,
      user_id: userId,
      role: "bottom",
      sort_order: 1,
    },
  ]);
  if (itemsError) throw itemsError;
  return candidateId;
}

describe("enqueue_outfit_preview_job(): freshness, dedup, and soft caps", () => {
  it("enqueues a job and returns the same candidate's job id as still-queued on a second call", async () => {
    const user = await freshUser();
    const candidateId = await seedActiveCandidate(user.id, "dedup");

    const { data: firstJobId, error: firstError } = await admin.rpc("enqueue_outfit_preview_job", {
      p_user_id: user.id,
      p_candidate_id: candidateId,
      p_priority_reason: "user_selected",
    });
    expect(firstError).toBeNull();
    expect(typeof firstJobId).toBe("string");

    // A still-queued job for the same candidate must not spawn a second row
    // (partial unique index on candidate_id where status in queued/running).
    const { data: secondJobId, error: secondError } = await admin.rpc(
      "enqueue_outfit_preview_job",
      {
        p_user_id: user.id,
        p_candidate_id: candidateId,
        p_priority_reason: "user_selected",
      },
    );
    expect(secondError).toBeNull();
    expect(secondJobId).toBeNull();

    const { data: jobs } = await admin
      .from("outfit_preview_jobs")
      .select("id")
      .eq("candidate_id", candidateId);
    expect(jobs?.length).toBe(1);
  });

  it("suppresses re-enqueue once a preview is ready with a matching source hash", async () => {
    const user = await freshUser();
    const candidateId = await seedActiveCandidate(user.id, "fresh-ready");

    const { data: jobId } = await admin.rpc("enqueue_outfit_preview_job", {
      p_user_id: user.id,
      p_candidate_id: candidateId,
      p_priority_reason: "user_selected",
    });
    const { data: job } = await admin
      .from("outfit_preview_jobs")
      .select("source_hash")
      .eq("id", jobId as string)
      .single();
    const sourceHash = (job as { source_hash: string }).source_hash;

    await admin
      .from("outfit_candidates")
      .update({
        preview_status: "ready",
        preview_bucket: "wardrobe-generated",
        preview_storage_path: `${user.id}/${candidateId}/preview-test.png`,
        preview_source_hash: sourceHash,
      })
      .eq("id", candidateId);
    await admin
      .from("outfit_preview_jobs")
      .update({ status: "complete" })
      .eq("id", jobId as string);

    const { data: nextJobId, error } = await admin.rpc("enqueue_outfit_preview_job", {
      p_user_id: user.id,
      p_candidate_id: candidateId,
      p_priority_reason: "frequently_suggested",
    });
    expect(error).toBeNull();
    expect(nextJobId).toBeNull();
  });

  it("returns null instead of erroring once the per-user queued-job soft cap is reached", async () => {
    const user = await freshUser();
    const candidateIds = await Promise.all(
      Array.from({ length: 3 }, (_, index) => seedActiveCandidate(user.id, `cap-${index}`)),
    );
    for (const candidateId of candidateIds) {
      const { error } = await admin.rpc("enqueue_outfit_preview_job", {
        p_user_id: user.id,
        p_candidate_id: candidateId,
        p_priority_reason: "user_selected",
        p_max_queued_per_user: 2,
      });
      expect(error).toBeNull();
    }
    const extraCandidateId = await seedActiveCandidate(user.id, "cap-extra");
    const { data: capped, error: cappedError } = await admin.rpc("enqueue_outfit_preview_job", {
      p_user_id: user.id,
      p_candidate_id: extraCandidateId,
      p_priority_reason: "user_selected",
      p_max_queued_per_user: 2,
    });
    expect(cappedError).toBeNull();
    expect(capped).toBeNull();
  });
});

describe("request_outfit_preview(): client-callable consent gate", () => {
  it("rejects a request from a user without active modeled-preview consent", async () => {
    const user = await freshUser();
    const candidateId = await seedActiveCandidate(user.id, "no-consent");

    const { error } = await user.client.rpc("request_outfit_preview", {
      p_candidate_id: candidateId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("succeeds once consent and an identity reference photo are on file", async () => {
    const user = await freshUser();
    const candidateId = await seedActiveCandidate(user.id, "consented");

    await admin
      .from("profiles")
      .update({
        identity_reference_path: `${user.id}/reference.png`,
        modeled_preview_consent: true,
      })
      .eq("id", user.id);

    const { data, error } = await user.client.rpc("request_outfit_preview", {
      p_candidate_id: candidateId,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "queued" });
  });
});

describe("profiles: modeled_preview_consent requires an identity reference", () => {
  it("rejects enabling consent before a reference photo is on file", async () => {
    const user = await freshUser();
    const { error } = await admin
      .from("profiles")
      .update({ modeled_preview_consent: true })
      .eq("id", user.id);
    expect(error).not.toBeNull();
  });
});

describe("claim_outfit_preview_jobs()/finalize_outfit_preview_job()/fail_outfit_preview_job(): lease semantics", () => {
  it("never lets two concurrent claims return the same job", async () => {
    const users = await Promise.all([freshUser(), freshUser(), freshUser()]);
    const candidateIds = await Promise.all(
      users.map((user, index) => seedActiveCandidate(user.id, `claim-${index}`)),
    );
    const jobIds: string[] = [];
    for (let index = 0; index < users.length; index += 1) {
      const { data } = await admin.rpc("enqueue_outfit_preview_job", {
        p_user_id: users[index]!.id,
        p_candidate_id: candidateIds[index]!,
        p_priority_reason: "user_selected",
      });
      jobIds.push(data as string);
    }

    const [first, second] = await Promise.all([
      admin.rpc("claim_outfit_preview_jobs", { p_limit: 2, p_lease_seconds: 300 }),
      admin.rpc("claim_outfit_preview_jobs", { p_limit: 2, p_lease_seconds: 300 }),
    ]);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const claimedIds = [...(first.data as { id: string }[]), ...(second.data as { id: string }[])]
      .map((row) => row.id)
      .filter((id) => jobIds.includes(id));
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
  });

  it("finalizes a leased job and marks the candidate's preview ready", async () => {
    const user = await freshUser();
    const candidateId = await seedActiveCandidate(user.id, "finalize");
    const { data: jobId } = await admin.rpc("enqueue_outfit_preview_job", {
      p_user_id: user.id,
      p_candidate_id: candidateId,
      p_priority_reason: "user_selected",
    });
    await admin.rpc("claim_outfit_preview_jobs", { p_limit: 10, p_lease_seconds: 300 });

    const { error } = await admin.rpc("finalize_outfit_preview_job", {
      p_job_id: jobId as string,
      p_user_id: user.id,
      p_bucket: "wardrobe-generated",
      p_storage_path: `${user.id}/${candidateId}/preview-finalize.png`,
      p_source_hash: "test-hash",
      p_model: "test-image-model",
    });
    expect(error).toBeNull();

    const { data: candidate } = await admin
      .from("outfit_candidates")
      .select("preview_status, preview_storage_path")
      .eq("id", candidateId)
      .single();
    expect(candidate?.preview_status).toBe("ready");

    const { data: job } = await admin
      .from("outfit_preview_jobs")
      .select("status")
      .eq("id", jobId as string)
      .single();
    expect(job?.status).toBe("complete");
  });

  it("fails a job that exceeded its retry budget to retry_exhausted instead of reclaiming it", async () => {
    const user = await freshUser();
    const candidateId = await seedActiveCandidate(user.id, "exhausted");
    const { data: inserted, error: insertError } = await admin
      .from("outfit_preview_jobs")
      .insert({
        user_id: user.id,
        candidate_id: candidateId,
        priority_reason: "user_selected",
        source_hash: "test-hash",
        status: "failed",
        attempt_count: 5,
        next_attempt_at: new Date(Date.now() - 60_000).toISOString(),
        locked_until: null,
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    const jobId = (inserted as { id: string }).id;

    const { data: claimed, error: claimError } = await admin.rpc("claim_outfit_preview_jobs", {
      p_limit: 10,
      p_lease_seconds: 300,
    });
    expect(claimError).toBeNull();
    expect((claimed as { id: string }[]).some((row) => row.id === jobId)).toBe(false);

    const { data: finalRow } = await admin
      .from("outfit_preview_jobs")
      .select("status, error_code")
      .eq("id", jobId)
      .single();
    expect(finalRow?.status).toBe("failed");
    expect(finalRow?.error_code).toBe("retry_exhausted");
  });
});
