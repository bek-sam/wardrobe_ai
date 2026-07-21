import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/response";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

const options = {
  feature: "stylist_generation",
  dailyLimit: 40,
  rollingBucket: "stylist_generation",
  rollingLimit: 5,
};

describe("AI usage limits", () => {
  it("requires both the rolling and daily budget", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { allowed: true, limit: 5, remaining: 4, reset_at: "2026-07-21T12:01:00Z" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { allowed: true, limit: 40, remaining: 39, reset_at: "2026-07-22T00:00:00Z" },
        error: null,
      });

    await expect(enforceAiUsageLimits({ rpc } as never, options)).resolves.toMatchObject({
      daily: { remaining: 39 },
      rolling: { remaining: 4 },
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("stops before consuming the daily budget when the burst limit is exhausted", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: false, limit: 5, remaining: 0, reset_at: "2026-07-21T12:01:00Z" },
      error: null,
    });

    await expect(enforceAiUsageLimits({ rpc } as never, options)).rejects.toMatchObject({
      status: 429,
      code: "rate_limit_reached",
    } satisfies Partial<ApiError>);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the database usage check is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(enforceAiUsageLimits({ rpc } as never, options)).rejects.toMatchObject({
      status: 503,
      code: "usage_check_failed",
    } satisfies Partial<ApiError>);
  });
});
