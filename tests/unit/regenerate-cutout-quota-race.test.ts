import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({ DAILY_IMAGE_LIMIT: 10, IMAGE_RATE_LIMIT_PER_MINUTE: 5 }),
}));

const enforceAiUsageLimitsMock = vi.fn();
vi.mock("@/lib/usage/limits", () => ({
  enforceAiUsageLimits: (...args: unknown[]) => enforceAiUsageLimitsMock(...args),
}));

type Call = { method: string; args: unknown[] };

function chainable(calls: Call[], result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["update", "select", "eq", "in", "not"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => {
    calls.push({ method: "maybeSingle", args: [] });
    return Promise.resolve(result);
  };
  return builder;
}

const INPUT = { instruction: null, cleanupTolerance: undefined };

describe("handleRegenerateCutout: quota-consumed-before-claim race (#9c)", () => {
  let calls: Call[];

  beforeEach(() => {
    calls = [];
    fromMock.mockReset();
    enforceAiUsageLimitsMock.mockReset();
  });

  it("never consumes quota when the atomic claim loses the race", async () => {
    fromMock.mockImplementation(() => chainable(calls, { data: null, error: null }));

    const { handleRegenerateCutout } =
      await import("@/app/api/imports/[jobId]/items/[candidateId]/regenerate-cutout/handler");

    await expect(
      handleRegenerateCutout({} as never, "user-1", "job-1", "candidate-1", INPUT as never),
    ).rejects.toThrow(/cannot be regenerated yet/i);
    expect(enforceAiUsageLimitsMock).not.toHaveBeenCalled();
  });

  it("reverts the claim to a failed/quota_exceeded state when quota enforcement fails after winning it", async () => {
    let call = 0;
    const results = [
      { data: { id: "candidate-1", status: "extracting" }, error: null },
      { data: null, error: null },
    ];
    fromMock.mockImplementation(() => {
      const result = results[Math.min(call, results.length - 1)]!;
      call += 1;
      return chainable(calls, result);
    });
    enforceAiUsageLimitsMock.mockRejectedValue(new Error("quota exceeded"));

    const { handleRegenerateCutout } =
      await import("@/app/api/imports/[jobId]/items/[candidateId]/regenerate-cutout/handler");

    await expect(
      handleRegenerateCutout({} as never, "user-1", "job-1", "candidate-1", INPUT as never),
    ).rejects.toThrow("quota exceeded");

    const updates = calls.filter((entry) => entry.method === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1]!.args[0]).toEqual({
      status: "failed",
      error_code: "quota_exceeded",
      error_message: "Daily image generation limit reached.",
    });
  });
});
