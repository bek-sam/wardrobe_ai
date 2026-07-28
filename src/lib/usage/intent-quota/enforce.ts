import type { WardrobeIntent } from "@/lib/ai/agents/orchestrator/intent/types";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceDailyLimit, enforceRollingLimit, type UsageClient } from "@/lib/usage/limits";

import { classificationQuotaPolicy, resolveIntentQuotaPolicy } from "./policy";
import type { QuotaPolicy } from "./types";

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
