import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildItemQuery } from "@/lib/ai/agents/orchestrator/intent/item-query";
import { resolveWardrobeIntentDeterministic } from "@/lib/ai/agents/orchestrator/intent/resolve-intent";
import { buildUnwornItems, buildWardrobeInsights, fetchInsightItems } from "@/lib/insights";
import { resolveIntentQuotaPolicy } from "@/lib/usage/intent-quota";
import { searchWardrobeItems } from "@/lib/wardrobe-search";

import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  insertWardrobeItem,
  type TestUser,
} from "./helpers";

const admin = createAdminClient();
const BASE_DATE = "2026-07-27";

let owner: TestUser;
let stranger: TestUser;
let blazerId: string;

/**
 * The deterministic routes answer from the user's own rows and call no model.
 * Every assertion here therefore runs against a real local Postgres with RLS
 * on, using the *authenticated user client* -- not the service-role client,
 * which bypasses RLS and would prove nothing about ownership.
 */
beforeAll(async () => {
  owner = await createTestUser(admin);
  stranger = await createTestUser(admin);

  const blazer = await insertWardrobeItem(admin, owner.id, {
    name: "Blue blazer",
    category: "outerwear",
    layer_role: "layer",
  });
  blazerId = blazer.id;
  await admin
    .from("wardrobe_items")
    .update({ color_names: ["blue"], wear_count: 4, last_worn_at: "2026-07-20" })
    .eq("id", blazerId);

  const neglected = await insertWardrobeItem(admin, owner.id, {
    name: "Green corduroy trousers",
    category: "bottoms",
    layer_role: "bottom",
  });
  await admin
    .from("wardrobe_items")
    .update({ color_names: ["green"], wear_count: 0, last_worn_at: null })
    .eq("id", neglected.id);

  // The other user owns a confusingly similar item.
  await insertWardrobeItem(admin, stranger.id, {
    name: "Blue blazer",
    category: "outerwear",
    layer_role: "layer",
  });
}, 60_000);

afterAll(async () => {
  if (owner) await deleteTestUser(admin, owner.id);
  if (stranger) await deleteTestUser(admin, stranger.id);
});

describe("item lookup against owned rows", () => {
  it("finds the owner's blue blazer through the authenticated client", async () => {
    const query = buildItemQuery("do i own a blue blazer?");
    const result = await searchWardrobeItems(owner.client, owner.id, query);

    expect(result.matchCount).toBeGreaterThan(0);
    expect(result.matches[0]).toMatchObject({ itemId: blazerId, name: "Blue blazer" });
  });

  it("routes the lowercase question deterministically and charges no daily quota", () => {
    const resolved = resolveWardrobeIntentDeterministic("do i own a blue blazer?", BASE_DATE);
    expect(resolved.intent).toBe("item_question");
    expect(resolveIntentQuotaPolicy(resolved.intent).daily).toBeNull();
  });

  it("returns nothing for an item the user does not own", async () => {
    const result = await searchWardrobeItems(
      owner.client,
      owner.id,
      buildItemQuery("do i own a yellow raincoat?"),
    );
    expect(result.matches.map((match) => match.name)).not.toContain("Yellow raincoat");
  });

  it("never surfaces another user's identically named item", async () => {
    const query = buildItemQuery("do i own a blue blazer?");
    const strangerResult = await searchWardrobeItems(stranger.client, stranger.id, query);

    expect(strangerResult.matchCount).toBe(1);
    expect(strangerResult.matches.map((match) => match.itemId)).not.toContain(blazerId);
  });

  it("blocks a cross-user lookup at RLS even when the id is guessed correctly", async () => {
    // Asking the *stranger's* authenticated client for the owner's rows.
    const leaked = await searchWardrobeItems(
      stranger.client,
      owner.id,
      buildItemQuery("do i own a blue blazer?"),
    );
    expect(leaked.matchCount).toBe(0);

    const { data } = await stranger.client.from("wardrobe_items").select("id").eq("id", blazerId);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("insight computation against real wear data", () => {
  it("computes wear statistics from the owner's own rows", async () => {
    const items = await fetchInsightItems(owner.client, owner.id);
    const insights = buildWardrobeInsights(items);

    expect(insights.itemCount).toBe(2);
    expect(insights.neverWorn.map((entry) => entry.name)).toContain("Green corduroy trousers");
    expect(insights.neverWorn.map((entry) => entry.name)).not.toContain("Blue blazer");
  });

  it("answers 'what have I not worn' from real last_worn_at values", async () => {
    const items = await fetchInsightItems(owner.client, owner.id);
    const unworn = buildUnwornItems(items, "2026-01-01", BASE_DATE);
    expect(unworn.map((entry) => entry.item.name)).toContain("Green corduroy trousers");
    // The blazer was worn inside the window, so it is not reported as unworn.
    expect(unworn.map((entry) => entry.item.name)).not.toContain("Blue blazer");
  });

  it("routes the insight question deterministically and charges no daily quota", () => {
    const resolved = resolveWardrobeIntentDeterministic(
      "what have i not worn this year?",
      BASE_DATE,
    );
    expect(resolved.intent).toBe("insight");
    expect(resolveIntentQuotaPolicy(resolved.intent).daily).toBeNull();
  });

  it("scopes insights to the caller, so a second user sees only their own", async () => {
    const strangerItems = await fetchInsightItems(stranger.client, stranger.id);
    expect(buildWardrobeInsights(strangerItems).itemCount).toBe(1);

    const leaked = await fetchInsightItems(stranger.client, owner.id);
    expect(leaked).toHaveLength(0);
  });
});

describe("feature usage counters for all five routes", () => {
  const dailyRoutes = [
    { intent: "outfit_request", feature: "stylist_generation" },
    { intent: "planning", feature: "planner_generation" },
    { intent: "packing", feature: "planner_generation" },
  ] as const;

  it("increments the real daily counter exactly once per model-backed route", async () => {
    for (const route of dailyRoutes) {
      const policy = resolveIntentQuotaPolicy(route.intent);
      expect(policy.daily?.feature).toBe(route.feature);

      const { data, error } = await owner.client.rpc("check_and_increment_usage", {
        p_feature: route.feature,
        p_limit: 50,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ allowed: true });
    }

    // The counter column is `usage_count`; selecting a name the table does not
    // have makes PostgREST return an error and no rows, which would leave every
    // lookup below undefined and the assertions unreachable rather than failing
    // honestly -- so the error is asserted too.
    const { data: counters, error: countersError } = await admin
      .from("feature_usage_counters")
      .select("feature, usage_count")
      .eq("user_id", owner.id);
    expect(countersError).toBeNull();
    const byFeature = new Map(
      (counters ?? []).map((row) => [row.feature as string, row.usage_count as number]),
    );
    expect(byFeature.get("stylist_generation")).toBe(1);
    // planning + packing both bill the planner feature.
    expect(byFeature.get("planner_generation")).toBe(2);
  });

  it("spends no daily counter for the deterministic routes, only a rolling bucket", async () => {
    for (const intent of ["item_question", "insight"] as const) {
      const policy = resolveIntentQuotaPolicy(intent);
      expect(policy.daily).toBeNull();

      const { data, error } = await owner.client.rpc("consume_rate_limit", {
        p_bucket: policy.rolling.bucket,
        p_limit: 50,
        p_window: "1 minute",
        p_cost: 1,
      });
      expect(error).toBeNull();
      expect(data).toMatchObject({ allowed: true });
    }

    const { data: counters } = await admin
      .from("feature_usage_counters")
      .select("feature")
      .eq("user_id", owner.id);
    expect((counters ?? []).map((row) => row.feature)).not.toContain("wardrobe_query");
  });

  it("enforces the rolling bucket once its limit is reached", async () => {
    const bucket = `integration_burst_${Date.now()}`;
    const first = await owner.client.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_limit: 1,
      p_window: "1 minute",
      p_cost: 1,
    });
    expect(first.data).toMatchObject({ allowed: true });

    const second = await owner.client.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_limit: 1,
      p_window: "1 minute",
      p_cost: 1,
    });
    expect(second.data).toMatchObject({ allowed: false });
  });

  it("keeps one user's usage counters invisible to another user", async () => {
    const { data } = await stranger.client
      .from("feature_usage_counters")
      .select("feature")
      .eq("user_id", owner.id);
    expect(data ?? []).toHaveLength(0);
  });
});
