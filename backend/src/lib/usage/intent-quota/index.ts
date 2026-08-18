import type { ServerEnvironment } from "@/lib/env/server";
import type { WardrobeIntent } from "@/lib/ai/agents/orchestrator/intent";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceDailyLimit, enforceRollingLimit, type UsageClient } from "@/lib/usage/limits";

/** Rolling-limit half of a policy: always present, always abuse-protection. */
export type RollingQuota = {
  bucket: string;
  /** Env key holding the per-minute allowance for this bucket. */
  limitKey: keyof ServerEnvironment;
};

/** Daily half of a policy: null when the route spends no generation budget. */
export type DailyQuota = {
  feature: "stylist_generation" | "planner_generation";
  /** Env key holding the daily allowance for this feature. */
  limitKey: keyof ServerEnvironment;
};

export type QuotaPolicy = {
  rolling: RollingQuota;
  daily: DailyQuota | null;
};

/**
 * Route -> budget matrix for the stylist chat boundary.
 *
 * - item_question / insight answer from the user's own rows with no model call
 *   at all, so they take a rolling abuse limit and no daily generation unit.
 * - outfit_request spends exactly one stylist unit.
 * - planning / packing both run the planner agent, so they spend exactly one
 *   planner unit and never touch the stylist budget.
 */
export const INTENT_QUOTA_POLICIES: Readonly<Record<WardrobeIntent, QuotaPolicy>> = {
  item_question: {
    rolling: { bucket: "wardrobe_query", limitKey: "WARDROBE_QUERY_RATE_LIMIT_PER_MINUTE" },
    daily: null,
  },
  insight: {
    rolling: { bucket: "wardrobe_query", limitKey: "WARDROBE_QUERY_RATE_LIMIT_PER_MINUTE" },
    daily: null,
  },
  outfit_request: {
    rolling: { bucket: "stylist_generation", limitKey: "STYLIST_RATE_LIMIT_PER_MINUTE" },
    daily: { feature: "stylist_generation", limitKey: "DAILY_STYLIST_LIMIT" },
  },
  planning: {
    rolling: { bucket: "planner_generation", limitKey: "PLANNER_RATE_LIMIT_PER_MINUTE" },
    daily: { feature: "planner_generation", limitKey: "DAILY_PLANNER_LIMIT" },
  },
  packing: {
    rolling: { bucket: "planner_generation", limitKey: "PLANNER_RATE_LIMIT_PER_MINUTE" },
    daily: { feature: "planner_generation", limitKey: "DAILY_PLANNER_LIMIT" },
  },
};

/**
 * Escalating an ambiguous request to the classifier model is a routing cost,
 * not a generation: it is rate-limited so it cannot be used as a free model
 * endpoint, but it never increments a daily generation counter.
 */
export const INTENT_CLASSIFICATION_POLICY: QuotaPolicy = {
  rolling: {
    bucket: "intent_classification",
    limitKey: "INTENT_CLASSIFICATION_RATE_LIMIT_PER_MINUTE",
  },
  daily: null,
};

/**
 * The single source of truth for what a stylist-chat route costs. Kept pure
 * (no environment, no client, no I/O) so the route-to-budget mapping can be
 * asserted directly in a unit test and cannot drift from the handlers.
 */
export function resolveIntentQuotaPolicy(intent: WardrobeIntent): QuotaPolicy {
  return INTENT_QUOTA_POLICIES[intent];
}

/** The rolling-only budget that guards one low-confidence classifier call. */
export function classificationQuotaPolicy(): QuotaPolicy {
  return INTENT_CLASSIFICATION_POLICY;
}

/** True when the route spends a daily AI-generation unit. */
export function consumesDailyGenerationQuota(intent: WardrobeIntent): boolean {
  return INTENT_QUOTA_POLICIES[intent].daily !== null;
}

function limitValue(key: QuotaPolicy["rolling"]["limitKey"]) {
  const value = getServerEnvironment()[key];
  return typeof value === "number" ? value : 1;
}

async function enforcePolicy(client: UsageClient, policy: QuotaPolicy) {
  const rolling = await enforceRollingLimit(client, {
    bucket: policy.rolling.bucket,
    limit: limitValue(policy.rolling.limitKey),
  });
  if (!policy.daily) return { rolling, daily: null };
  const daily = await enforceDailyLimit(client, {
    feature: policy.daily.feature,
    limit: limitValue(policy.daily.limitKey),
  });
  return { rolling, daily };
}

/** Charges exactly the budget the resolved route is supposed to cost. */
export function enforceIntentQuota(client: UsageClient, intent: WardrobeIntent) {
  return enforcePolicy(client, resolveIntentQuotaPolicy(intent));
}

/** Charges the rolling-only budget that precedes one classifier model call. */
export function enforceClassificationQuota(client: UsageClient) {
  return enforcePolicy(client, classificationQuotaPolicy());
}
