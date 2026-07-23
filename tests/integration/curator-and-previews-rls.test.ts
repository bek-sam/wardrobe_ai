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

describe("RLS: wardrobe_change_events", () => {
  it("lets a user read their own change events", async () => {
    // Inserting a wardrobe item fires record_wardrobe_change_event(), which
    // writes a 'created' row for this user.
    await insertWardrobeItem(admin, userA.id);
    const { data, error } = await userA.client
      .from("wardrobe_change_events")
      .select("user_id, change_type")
      .eq("user_id", userA.id)
      .eq("change_type", "created");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("never returns another user's change events", async () => {
    const { data, error } = await userB.client
      .from("wardrobe_change_events")
      .select("id")
      .eq("user_id", userA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("blocks a signed-in user from writing directly to wardrobe_change_events", async () => {
    const { error } = await userA.client.from("wardrobe_change_events").insert({
      user_id: userA.id,
      change_type: "preference_changed",
      item_version: "manual-insert-attempt",
    });
    expect(error).not.toBeNull();
  });
});

describe("RLS: outfit_analysis_cache", () => {
  async function seedCacheRow(userId: string) {
    const { data, error } = await admin
      .from("outfit_analysis_cache")
      .insert({
        user_id: userId,
        analysis_hash: `hash-${userId}-${Date.now()}`,
        candidate_key: "combo-key",
        model: "test-model",
        prompt_version: "v1",
        knowledge_version: "test-version",
        structured_result: { decision: "select" },
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Failed to seed outfit_analysis_cache row.");
    return (data as { id: string }).id;
  }

  it("lets a user read their own cached analysis row", async () => {
    await seedCacheRow(userA.id);
    const { data, error } = await userA.client
      .from("outfit_analysis_cache")
      .select("user_id")
      .eq("user_id", userA.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("never returns another user's cached analysis row", async () => {
    const { data, error } = await userB.client
      .from("outfit_analysis_cache")
      .select("id")
      .eq("user_id", userA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("blocks a signed-in user from writing directly to outfit_analysis_cache", async () => {
    const { error } = await userA.client.from("outfit_analysis_cache").insert({
      user_id: userA.id,
      analysis_hash: "manual-insert-attempt",
      candidate_key: "combo-key",
      model: "test-model",
      prompt_version: "v1",
      knowledge_version: "test-version",
      structured_result: {},
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });
});

describe("RLS: outfit_preview_jobs", () => {
  async function seedActiveCandidate(userId: string) {
    const top = await insertWardrobeItem(admin, userId, { layer_role: "top" });
    const bottom = await insertWardrobeItem(admin, userId, {
      layer_role: "bottom",
      category: "bottoms",
    });
    const { data: candidate, error: candidateError } = await admin
      .from("outfit_candidates")
      .insert({
        user_id: userId,
        combination_key: `preview-rls:${top.id}:${bottom.id}`,
        compiled_wardrobe_version: "v1",
        status: "active",
        total_score: 0.7,
      })
      .select("id")
      .single();
    if (candidateError || !candidate) throw candidateError ?? new Error("candidate insert failed");
    return (candidate as { id: string }).id;
  }

  it("lets a user read their own preview job row", async () => {
    const candidateId = await seedActiveCandidate(userA.id);
    const { data: job, error: jobError } = await admin
      .from("outfit_preview_jobs")
      .insert({
        user_id: userA.id,
        candidate_id: candidateId,
        priority_reason: "user_selected",
        source_hash: "test-hash",
      })
      .select("id")
      .single();
    expect(jobError).toBeNull();

    const { data, error } = await userA.client
      .from("outfit_preview_jobs")
      .select("id")
      .eq("id", (job as { id: string }).id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(1);
  });

  it("never returns another user's preview job rows", async () => {
    const { data, error } = await userB.client
      .from("outfit_preview_jobs")
      .select("id")
      .eq("user_id", userA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("blocks a signed-in user from writing directly to outfit_preview_jobs", async () => {
    const candidateId = await seedActiveCandidate(userA.id);
    const { error } = await userA.client.from("outfit_preview_jobs").insert({
      user_id: userA.id,
      candidate_id: candidateId,
      priority_reason: "user_selected",
      source_hash: "manual-insert-attempt",
    });
    expect(error).not.toBeNull();
  });
});
