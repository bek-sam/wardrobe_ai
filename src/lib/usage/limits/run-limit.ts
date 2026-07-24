import { ApiError } from "@/lib/api/response";

import { limitResultSchema } from "./schemas";
import type { UsageClient } from "./types";

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
