import { ApiError } from "@/lib/api/response";

import { runLimit } from "./run-limit";
import type { UsageClient } from "./types";

/**
 * Burst protection only. Every chat route consumes one of these, including the
 * deterministic lookup/insight routes that spend no daily AI budget, so abuse
 * is still bounded without charging a generation the user never asked for.
 */
export async function enforceRollingLimit(
  client: UsageClient,
  options: { bucket: string; limit: number; window?: string; cost?: number },
) {
  const rolling = await runLimit(client, "consume_rate_limit", {
    p_bucket: options.bucket,
    p_limit: options.limit,
    p_window: options.window ?? "1 minute",
    p_cost: options.cost ?? 1,
  });
  if (!rolling.allowed) {
    throw new ApiError(429, "rate_limit_reached", "Please wait before trying this again.", {
      remaining: rolling.remaining,
      resetAt: rolling.reset_at ?? null,
    });
  }
  return rolling;
}
