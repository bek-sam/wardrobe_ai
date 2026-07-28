import { ApiError } from "@/lib/api/response";

import { runLimit } from "./run-limit";
import type { UsageClient } from "./types";

/**
 * The daily generation budget. Consumed exactly once per model-backed route,
 * at the authenticated request boundary, so a route that fans out internally
 * cannot charge the same budget twice.
 */
export async function enforceDailyLimit(
  client: UsageClient,
  options: { feature: string; limit: number },
) {
  const daily = await runLimit(client, "check_and_increment_usage", {
    p_feature: options.feature,
    p_limit: options.limit,
  });
  if (!daily.allowed) {
    throw new ApiError(
      429,
      "daily_limit_reached",
      "The daily limit for this AI feature is reached.",
      { remaining: daily.remaining, resetAt: daily.reset_at ?? null },
    );
  }
  return daily;
}
