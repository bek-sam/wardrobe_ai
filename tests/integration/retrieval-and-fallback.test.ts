import { afterAll, describe, expect, it } from "vitest";

import {
  markOutfitCandidateSuggested,
  recordFallbackOutfitCandidate,
  retrieveStoredOutfitCandidates,
} from "@/lib/ai/agents/retrieve-outfit-candidate";
import { resolveOccasionContext } from "@/lib/recommendation";

import { createAdminClient, createTestUser, deleteTestUser, insertWardrobeItem } from "./helpers";

const admin = createAdminClient();
const createdUserIds: string[] = [];

afterAll(async () => {
  await Promise.all(createdUserIds.map((id) => deleteTestUser(admin, id)));
});

async function freshUser() {
  const user = await createTestUser(admin);
  createdUserIds.push(user.id);
  return user;
}

async function publishLibraryVersion(userId: string, version: string) {
  const { error } = await admin.from("wardrobe_compilation_state").upsert(
    {
      user_id: userId,
      compiled_wardrobe_version: version,
      dirty_since: null,
      candidate_count: 1,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

async function seedActiveCandidate(
  userId: string,
  version: string,
  topId: string,
  bottomId: string,
  overrides: { occasionCategory?: string; timesSuggested?: number } = {},
) {
  const { data: candidate, error: candidateError } = await admin
    .from("outfit_candidates")
    .insert({
      user_id: userId,
      combination_key: `retrieval:${version}:${topId}:${bottomId}`,
      compiled_wardrobe_version: version,
      status: "active",
      occasion_category: overrides.occasionCategory ?? null,
      occasion_categories: overrides.occasionCategory ? [overrides.occasionCategory] : [],
      total_score: 0.8,
      preference_match: 0.7,
      times_suggested: overrides.timesSuggested ?? 0,
    })
    .select("id")
    .single();
  if (candidateError || !candidate) throw candidateError ?? new Error("seed candidate failed");
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

describe("retrieveStoredOutfitCandidates(): library retrieval", () => {
  it("returns nothing when the user has no compiled library", async () => {
    const user = await freshUser();
    const results = await retrieveStoredOutfitCandidates({
      userId: user.id,
      occasionContext: resolveOccasionContext(null),
    });
    expect(results).toEqual([]);
  });

  it("returns nothing while the library is dirty, even if a version was previously published", async () => {
    const user = await freshUser();
    const top = await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    const bottom = await insertWardrobeItem(admin, user.id, {
      layer_role: "bottom",
      category: "bottoms",
    });
    await publishLibraryVersion(user.id, "v1");
    await seedActiveCandidate(user.id, "v1", top.id, bottom.id);
    // Simulate a pending edit: dirty_since set after publish.
    await admin
      .from("wardrobe_compilation_state")
      .update({ dirty_since: new Date().toISOString() })
      .eq("user_id", user.id);

    const results = await retrieveStoredOutfitCandidates({
      userId: user.id,
      occasionContext: resolveOccasionContext(null),
    });
    expect(results).toEqual([]);
  });

  it("retrieves a published candidate, prefiltered by resolved occasion category", async () => {
    const user = await freshUser();
    const top = await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    const bottom = await insertWardrobeItem(admin, user.id, {
      layer_role: "bottom",
      category: "bottoms",
    });
    await publishLibraryVersion(user.id, "v1");
    await seedActiveCandidate(user.id, "v1", top.id, bottom.id, { occasionCategory: "business" });

    const results = await retrieveStoredOutfitCandidates({
      userId: user.id,
      occasionContext: resolveOccasionContext("business dinner with clients"),
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.selectionReason).toBe("safest");
    expect(results[0]?.items.map((item) => item.item_id).sort()).toEqual(
      [top.id, bottom.id].sort(),
    );
  });

  it("excludes a candidate once one of its items is no longer available", async () => {
    const user = await freshUser();
    const top = await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    const bottom = await insertWardrobeItem(admin, user.id, {
      layer_role: "bottom",
      category: "bottoms",
    });
    await publishLibraryVersion(user.id, "v1");
    await seedActiveCandidate(user.id, "v1", top.id, bottom.id);

    await admin
      .from("wardrobe_items")
      .update({ availability_status: "laundry" })
      .eq("id", bottom.id);

    const results = await retrieveStoredOutfitCandidates({
      userId: user.id,
      occasionContext: resolveOccasionContext(null),
    });
    expect(
      results.every((candidate) => !candidate.items.some((item) => item.item_id === bottom.id)),
    ).toBe(true);
  });

  it("increments exposure atomically via increment_outfit_candidate_exposure", async () => {
    const user = await freshUser();
    const top = await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    const bottom = await insertWardrobeItem(admin, user.id, {
      layer_role: "bottom",
      category: "bottoms",
    });
    await publishLibraryVersion(user.id, "v1");
    const candidateId = await seedActiveCandidate(user.id, "v1", top.id, bottom.id);

    await markOutfitCandidateSuggested(user.id, candidateId);
    await markOutfitCandidateSuggested(user.id, candidateId);

    const { data } = await admin
      .from("outfit_candidates")
      .select("times_suggested, last_suggested_at")
      .eq("id", candidateId)
      .single();
    expect(data?.times_suggested).toBe(2);
    expect(data?.last_suggested_at).not.toBeNull();
  });
});

describe("record_fallback_outfit_candidate(): atomic fallback growth", () => {
  it("grows the library with an owned, available combination", async () => {
    const user = await freshUser();
    const top = await insertWardrobeItem(admin, user.id, { layer_role: "top" });
    const bottom = await insertWardrobeItem(admin, user.id, {
      layer_role: "bottom",
      category: "bottoms",
    });
    await publishLibraryVersion(user.id, "v1");

    await recordFallbackOutfitCandidate({
      userId: user.id,
      occasion: "casual weekend",
      items: [
        { item_id: top.id, role: "top", sort_order: 0 },
        { item_id: bottom.id, role: "bottom", sort_order: 1 },
      ],
    });

    const { data: candidates } = await admin
      .from("outfit_candidates")
      .select("id, generated_by, outfit_candidate_items(item_id)")
      .eq("user_id", user.id)
      .eq("generated_by", "fallback_llm");
    expect(candidates?.length).toBe(1);
    // Never an active candidate with zero items: item rows were inserted in
    // the same transaction as the candidate row.
    expect((candidates?.[0]?.outfit_candidate_items as unknown[] | null)?.length).toBe(2);
  });

  it("rejects an item the user doesn't own via the RPC directly", async () => {
    const owner = await freshUser();
    const otherUser = await freshUser();
    const notOwnedItem = await insertWardrobeItem(admin, otherUser.id, { layer_role: "top" });
    const ownedBottom = await insertWardrobeItem(admin, owner.id, {
      layer_role: "bottom",
      category: "bottoms",
    });

    const { error } = await admin.rpc("record_fallback_outfit_candidate", {
      p_user_id: owner.id,
      p_combination_key: "fallback:not-owned",
      p_occasion_category: "casual",
      p_occasion_tags: ["casual"],
      p_items: [
        { item_id: notOwnedItem.id, role: "top", sort_order: 0 },
        { item_id: ownedBottom.id, role: "bottom", sort_order: 1 },
      ],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not_owned_or_unavailable/);

    const { data: candidates } = await admin
      .from("outfit_candidates")
      .select("id")
      .eq("user_id", owner.id)
      .eq("combination_key", "fallback:not-owned");
    expect(candidates).toEqual([]);
  });
});
