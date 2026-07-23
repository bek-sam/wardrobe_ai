import { afterAll, describe, expect, it } from "vitest";

import { compileWardrobeForUser } from "@/jobs/compile-wardrobe";
import { retrieveStoredOutfitCandidates } from "@/lib/ai/agents/retrieve-outfit-candidate";

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

describe("compileWardrobeForUser(): curator failure fallback and incremental compilation", () => {
  it("publishes a fully usable deterministic library when no curator model is configured", async () => {
    // OPENAI_CURATOR_MODEL is not set in the integration test environment
    // (global-setup only aliases Supabase env vars), so the curator pass
    // inside compileWardrobeForUser must skip the model call entirely and
    // leave every candidate curator_status='not_reviewed' without failing
    // the compile.
    const user = await freshUser();
    await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    await insertWardrobeItem(admin, user.id, { layer_role: "bottom", category: "bottoms" });
    const jobId = await claimAJob(user.id);

    const result = await compileWardrobeForUser(user.id, jobId);
    expect(result.status).toBe("complete");
    expect(result.candidatesGenerated).toBeGreaterThan(0);
    expect(result.curatorCalls).toBe(0);

    const { data: candidates } = await admin
      .from("outfit_candidates")
      .select("curator_status, generated_by")
      .eq("user_id", user.id)
      .eq("status", "active");
    expect(candidates?.length).toBeGreaterThan(0);
    expect(candidates?.every((row) => row.curator_status === "not_reviewed")).toBe(true);
    expect(candidates?.every((row) => row.generated_by === "compilation")).toBe(true);

    // The deterministic library must remain fully retrievable -- curator
    // failure never blocks stylist retrieval.
    const retrieved = await retrieveStoredOutfitCandidates({ userId: user.id });
    expect(retrieved.length).toBeGreaterThan(0);
  });

  it("marks every unprocessed wardrobe_change_events row as processed after a successful compile", async () => {
    const user = await freshUser();
    await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    const jobId = await claimAJob(user.id);
    await compileWardrobeForUser(user.id, jobId);

    const { data: unprocessed } = await admin
      .from("wardrobe_change_events")
      .select("id")
      .eq("user_id", user.id)
      .is("processed_at", null);
    expect(unprocessed).toEqual([]);
  });

  it("excludes curator-rejected candidates from retrieval while keeping them in storage", async () => {
    const user = await freshUser();
    await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    await insertWardrobeItem(admin, user.id, { layer_role: "bottom", category: "bottoms" });
    const jobId = await claimAJob(user.id);
    await compileWardrobeForUser(user.id, jobId);

    const { data: candidateRows } = await admin
      .from("outfit_candidates")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);
    const candidateId = (candidateRows?.[0] as { id: string } | undefined)?.id;
    expect(candidateId).toBeDefined();

    await admin
      .from("outfit_candidates")
      .update({ curator_status: "rejected", curator_rejection_reason: "color_conflict" })
      .eq("id", candidateId as string);

    const retrieved = await retrieveStoredOutfitCandidates({ userId: user.id });
    expect(retrieved.every((candidate) => candidate.candidateId !== candidateId)).toBe(true);

    const { data: stillStored } = await admin
      .from("outfit_candidates")
      .select("id, status")
      .eq("id", candidateId as string)
      .single();
    expect(stillStored?.status).toBe("active");
  });

  it("preserves a candidate's curator verdict across an unrelated recompile (upsert, not delete-then-insert)", async () => {
    const user = await freshUser();
    const top = await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    const bottom = await insertWardrobeItem(admin, user.id, {
      layer_role: "bottom",
      category: "bottoms",
    });
    const firstJobId = await claimAJob(user.id);
    await compileWardrobeForUser(user.id, firstJobId);

    const { data: candidateRows } = await admin
      .from("outfit_candidates")
      .select("id, combination_key")
      .eq("user_id", user.id)
      .eq("status", "active");
    const target = candidateRows?.[0] as { id: string; combination_key: string } | undefined;
    expect(target).toBeDefined();

    await admin
      .from("outfit_candidates")
      .update({
        curator_status: "selected",
        curator_confidence: 0.9,
        curator_model: "test-model",
        curator_prompt_version: "v1",
      })
      .eq("id", target!.id);

    // A change to an unrelated item (a third, newly added accessory) marks
    // the library dirty and queues a follow-up compile job; the previously
    // curated top+bottom combination itself is untouched.
    await insertWardrobeItem(admin, user.id, {
      layer_role: "accessory",
      category: "accessories",
    });
    const secondJobId = await claimAJob(user.id);
    await compileWardrobeForUser(user.id, secondJobId);

    const { data: sameCandidate } = await admin
      .from("outfit_candidates")
      .select("id, curator_status, curator_confidence")
      .eq("user_id", user.id)
      .eq("combination_key", target!.combination_key)
      .eq("status", "active")
      .maybeSingle();
    expect(sameCandidate?.curator_status).toBe("selected");
    expect(sameCandidate?.curator_confidence).toBe(0.9);
    void top;
    void bottom;
  });
});
