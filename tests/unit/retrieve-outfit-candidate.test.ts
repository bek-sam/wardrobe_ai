import { beforeEach, describe, expect, it, vi } from "vitest";

import { ITEM_IDS, makeWardrobeItem, USER_ID } from "./fixtures";

type FakeResult = { data: unknown; error: unknown };

function fakeQuery(initialResult: FakeResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const state = { result: initialResult };
  const builder: Record<string, unknown> = {};
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  for (const method of ["select", "eq", "neq", "order", "limit", "in", "is"]) {
    builder[method] = record(method);
  }
  builder.maybeSingle = () => {
    calls.push({ method: "maybeSingle", args: [] });
    return Promise.resolve(state.result);
  };
  builder.then = (resolve: (value: FakeResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(state.result).then(resolve, reject);
  return { builder, calls, state };
}

const stateQuery = fakeQuery({
  data: { dirty_since: null, compiled_wardrobe_version: "v1" },
  error: null,
});

const candidateRows = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    times_suggested: 0,
    last_suggested_at: null,
    preference_match: 0.5,
    outfit_candidate_items: [
      { item_id: ITEM_IDS.topA, role: "top", sort_order: 0 },
      { item_id: ITEM_IDS.bottomA, role: "bottom", sort_order: 1 },
    ],
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000002",
    times_suggested: 10,
    last_suggested_at: null,
    preference_match: 0.9,
    outfit_candidate_items: [
      { item_id: ITEM_IDS.topB, role: "top", sort_order: 0 },
      { item_id: ITEM_IDS.bottomB, role: "bottom", sort_order: 1 },
    ],
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000003",
    times_suggested: 0,
    last_suggested_at: null,
    preference_match: 0.2,
    outfit_candidate_items: [{ item_id: ITEM_IDS.dress, role: "dress", sort_order: 0 }],
  },
];

const candidatesQuery = fakeQuery({ data: candidateRows, error: null });

const itemRows = [
  makeWardrobeItem({ id: ITEM_IDS.topA, layer_role: "top" }),
  makeWardrobeItem({ id: ITEM_IDS.bottomA, category: "bottoms", layer_role: "bottom" }),
  makeWardrobeItem({ id: ITEM_IDS.topB, layer_role: "top" }),
  makeWardrobeItem({ id: ITEM_IDS.bottomB, category: "bottoms", layer_role: "bottom" }),
  makeWardrobeItem({ id: ITEM_IDS.dress, category: "dresses", layer_role: "dress" }),
];
const itemsQuery = fakeQuery({ data: itemRows, error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "wardrobe_compilation_state") return stateQuery.builder;
  if (table === "outfit_candidates") return candidatesQuery.builder;
  if (table === "wardrobe_items") return itemsQuery.builder;
  throw new Error(`unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

const { retrieveStoredOutfitCandidates } =
  await import("@/lib/ai/agents/retrieve-outfit-candidate");

describe("retrieveStoredOutfitCandidates", () => {
  beforeEach(() => {
    candidatesQuery.calls.length = 0;
  });

  it("returns nothing when the compiled library is missing, dirty, or unversioned", async () => {
    stateQuery.state.result = { data: null, error: null };
    const result = await retrieveStoredOutfitCandidates({ userId: USER_ID });
    expect(result).toEqual([]);
    stateQuery.state.result = {
      data: { dirty_since: null, compiled_wardrobe_version: "v1" },
      error: null,
    };
  });

  it("prefilters by occasion_category when the occasion resolves with confidence", async () => {
    await retrieveStoredOutfitCandidates({ userId: USER_ID, occasion: "business dinner" });
    const eqCalls = candidatesQuery.calls.filter((call) => call.method === "eq");
    expect(eqCalls).toContainEqual({ method: "eq", args: ["occasion_category", "business"] });
  });

  it("does not prefilter by occasion_category for low-confidence/unmatched text", async () => {
    await retrieveStoredOutfitCandidates({ userId: USER_ID, occasion: "xyz nonsense" });
    const eqCalls = candidatesQuery.calls.filter((call) => call.method === "eq");
    expect(eqCalls.some((call) => call.args[0] === "occasion_category")).toBe(false);
  });

  it("returns up to 3 diverse alternatives ranked safest first", async () => {
    const results = await retrieveStoredOutfitCandidates({ userId: USER_ID });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    expect(results[0]?.selectionReason).toBe("safest");

    const reasons = results.map((entry) => entry.selectionReason);
    expect(new Set(reasons).size).toBe(reasons.length);
    const candidateIds = results.map((entry) => entry.candidateId);
    expect(new Set(candidateIds).size).toBe(candidateIds.length);
  });

  it("prefers the least-suggested candidate for the underused pick", async () => {
    const results = await retrieveStoredOutfitCandidates({ userId: USER_ID });
    const underused = results.find((entry) => entry.selectionReason === "underused");
    expect(underused).toBeDefined();
    expect(underused?.candidateId).not.toBe(
      "aaaaaaaa-0000-4000-8000-000000000002", // heavily-suggested candidate
    );
  });
});
