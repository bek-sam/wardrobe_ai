import type { WardrobeIntent } from "@/lib/ai/agents/orchestrator/intent/types";

import { INTENT_QUOTA_POLICIES, INTENT_CLASSIFICATION_POLICY } from "./policy.data";
import type { QuotaPolicy } from "./types";

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

export { INTENT_QUOTA_POLICIES } from "./policy.data";
