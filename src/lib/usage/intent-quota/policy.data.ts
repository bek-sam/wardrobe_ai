import type { WardrobeIntent } from "@/lib/ai/agents/orchestrator/intent/types";

import type { QuotaPolicy } from "./types";

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
