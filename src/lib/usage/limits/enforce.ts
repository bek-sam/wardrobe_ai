import { ApiError } from "@/lib/api/response";

import { runLimit } from "./run-limit";
import type { UsageClient } from "./types";

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
  const rolling = await runLimit(client, "consume_rate_limit", {
    p_bucket: options.rollingBucket,
    p_limit: options.rollingLimit,
    p_window: options.rollingWindow ?? "1 minute",
    p_cost: 1,
  });
  if (!rolling.allowed) {
    throw new ApiError(
      429,
      "rate_limit_reached",
      "Please wait before trying this AI feature again.",
      {
        remaining: rolling.remaining,
        resetAt: rolling.reset_at ?? null,
      },
    );
  }

  const daily = await runLimit(client, "check_and_increment_usage", {
    p_feature: options.feature,
    p_limit: options.dailyLimit,
  });
  if (!daily.allowed) {
    throw new ApiError(
      429,
      "daily_limit_reached",
      "The daily limit for this AI feature is reached.",
      {
        remaining: daily.remaining,
        resetAt: daily.reset_at ?? null,
      },
    );
  }

  return { rolling, daily };
}
