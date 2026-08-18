import { describe, expect, it } from "vitest";

import { WARDROBE_INTENTS } from "@/lib/ai/agents/orchestrator/intent";
import {
  INTENT_CLASSIFICATION_POLICY,
  INTENT_QUOTA_POLICIES,
  classificationQuotaPolicy,
  consumesDailyGenerationQuota,
  resolveIntentQuotaPolicy,
} from "@/lib/usage/intent-quota";

/**
 * The route -> budget matrix is the contract the chat boundary bills against.
 * Asserting it directly (rather than only through the enforcement path) is
 * what stops a handler change from silently re-pricing a route.
 */
describe("stylist chat quota policy matrix", () => {
  it("charges deterministic routes a rolling limit and no daily generation unit", () => {
    for (const intent of ["item_question", "insight"] as const) {
      const policy = resolveIntentQuotaPolicy(intent);
      expect(policy.rolling.bucket).toBe("wardrobe_query");
      expect(policy.rolling.limitKey).toBe("WARDROBE_QUERY_RATE_LIMIT_PER_MINUTE");
      expect(policy.daily).toBeNull();
      expect(consumesDailyGenerationQuota(intent)).toBe(false);
    }
  });

  it("charges an outfit request exactly one stylist unit", () => {
    const policy = resolveIntentQuotaPolicy("outfit_request");
    expect(policy.rolling.bucket).toBe("stylist_generation");
    expect(policy.daily).toEqual({
      feature: "stylist_generation",
      limitKey: "DAILY_STYLIST_LIMIT",
    });
    expect(consumesDailyGenerationQuota("outfit_request")).toBe(true);
  });

  it("charges planning and packing one planner unit and never a stylist unit", () => {
    for (const intent of ["planning", "packing"] as const) {
      const policy = resolveIntentQuotaPolicy(intent);
      expect(policy.rolling.bucket).toBe("planner_generation");
      expect(policy.daily).toEqual({
        feature: "planner_generation",
        limitKey: "DAILY_PLANNER_LIMIT",
      });
      expect(policy.daily?.feature).not.toBe("stylist_generation");
      expect(policy.rolling.bucket).not.toBe("stylist_generation");
    }
  });

  it("rate-limits classification without charging a daily generation unit", () => {
    const policy = classificationQuotaPolicy();
    expect(policy).toEqual(INTENT_CLASSIFICATION_POLICY);
    expect(policy.rolling.bucket).toBe("intent_classification");
    expect(policy.rolling.limitKey).toBe("INTENT_CLASSIFICATION_RATE_LIMIT_PER_MINUTE");
    expect(policy.daily).toBeNull();
  });

  it("prices every known intent exactly once, with no route left unbilled", () => {
    expect(Object.keys(INTENT_QUOTA_POLICIES).sort()).toEqual([...WARDROBE_INTENTS].sort());
    for (const intent of WARDROBE_INTENTS) {
      const policy = resolveIntentQuotaPolicy(intent);
      expect(policy.rolling.bucket).toBeTruthy();
      expect(policy.rolling.limitKey).toBeTruthy();
    }
  });

  it("keeps the classification bucket separate from every route bucket", () => {
    const routeBuckets = WARDROBE_INTENTS.map(
      (intent) => resolveIntentQuotaPolicy(intent).rolling.bucket,
    );
    expect(routeBuckets).not.toContain(INTENT_CLASSIFICATION_POLICY.rolling.bucket);
  });
});
