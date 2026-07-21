import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ApiError } from "@/lib/api/response";

const limitResultSchema = z
  .object({
    allowed: z.boolean(),
    limit: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    reset_at: z.string().nullable().optional(),
  })
  .passthrough();

type UsageClient = Pick<SupabaseClient, "rpc">;

async function runLimit(
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
