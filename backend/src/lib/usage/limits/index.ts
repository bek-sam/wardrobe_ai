import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/response";
import { z } from "zod";

export type UsageClient = Pick<SupabaseClient, "rpc">;

const limitResultSchema = z
  .object({
    allowed: z.boolean(),
    limit: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    reset_at: z.string().nullable().optional(),
  })
  .passthrough();

export async function runLimit(
  client: UsageClient,
  functionName: "consume_rate_limit" | "check_and_increment_usage",
  parameters: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) throw new ApiError(503, "usage_check_failed", "Usage limits could not be checked.");
  const parsed = limitResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(503, "usage_check_failed", "Usage limits could not be checked.");
  }
  return parsed.data;
}

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
