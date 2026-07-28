import { enforceDailyLimit } from "./daily";
import { enforceRollingLimit } from "./rolling";
import type { UsageClient } from "./types";

/**
 * Combined rolling + daily enforcement, kept as the single call every ordinary
 * AI endpoint (import, research, preview, planner, stylist) already uses. The
 * two halves are exported separately for callers that must charge only one of
 * them -- see lib/usage/intent-quota for the stylist chat matrix.
 */
export async function enforceAiUsageLimits(
  client: UsageClient,
  options: {
    feature: string;
    dailyLimit: number;
    rollingBucket: string;
    rollingLimit: number;
    rollingWindow?: string;
  },
) {
  const rolling = await enforceRollingLimit(client, {
    bucket: options.rollingBucket,
    limit: options.rollingLimit,
    window: options.rollingWindow,
  });
  const daily = await enforceDailyLimit(client, {
    feature: options.feature,
    limit: options.dailyLimit,
  });
  return { rolling, daily };
}
