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

const regenerateCropMock = vi.fn();
vi.mock("@/app/api/imports/[jobId]/items/[candidateId]/approve-crop/regenerate-crop", () => ({
  regenerateCrop: (...args: unknown[]) => regenerateCropMock(...args),
}));

type Call = { table: string; method: string; args: unknown[] };

function chainable(table: string, calls: Call[], result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["update", "select", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => {
    calls.push({ table, method: "maybeSingle", args: [] });
    return Promise.resolve(result);
  };
  builder.single = () => {
    calls.push({ table, method: "single", args: [] });
    return Promise.resolve(result);
  };
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

const JOB_RESULT = {
  data: { original_image_bucket: "wardrobe-originals", original_image_path: "u/original.jpg" },
  error: null,
};

describe("handleApproveCrop: quota-consumed-before-claim race (#9b)", () => {
  let calls: Call[];

  beforeEach(() => {
    calls = [];
    fromMock.mockReset();
    enforceAiUsageLimitsMock.mockReset();
    regenerateCropMock.mockReset();
  });

  it("never consumes quota when the atomic claim loses the race", async () => {
    let candidateCall = 0;
    const candidateResults = [{ data: null, error: null }];
    fromMock.mockImplementation((table: string) => {
      if (table === "import_job_candidates") {
        const result = candidateResults[Math.min(candidateCall, candidateResults.length - 1)]!;
        candidateCall += 1;
        return chainable(table, calls, result);
      }
      return chainable(table, calls, JOB_RESULT);
    });

    const { handleApproveCrop } =
      await import("@/app/api/imports/[jobId]/items/[candidateId]/approve-crop/handler");

    await expect(handleApproveCrop({} as never, "user-1", "job-1", "candidate-1")).rejects.toThrow(
      /not awaiting approval/i,
    );
    expect(enforceAiUsageLimitsMock).not.toHaveBeenCalled();
    expect(regenerateCropMock).not.toHaveBeenCalled();
  });

  it("reverts the claim back to review_crop when quota enforcement fails after winning it", async () => {
    let candidateCall = 0;
    const candidateResults = [
      { data: { bounding_box: {}, crop_storage_path: "u/crop.png" }, error: null },
      { data: null, error: null },
    ];
    fromMock.mockImplementation((table: string) => {
      if (table === "import_job_candidates") {
        const result = candidateResults[Math.min(candidateCall, candidateResults.length - 1)]!;
        candidateCall += 1;
        return chainable(table, calls, result);
      }
      return chainable(table, calls, JOB_RESULT);
    });
    enforceAiUsageLimitsMock.mockRejectedValue(new Error("quota exceeded"));

    const { handleApproveCrop } =
      await import("@/app/api/imports/[jobId]/items/[candidateId]/approve-crop/handler");

    await expect(handleApproveCrop({} as never, "user-1", "job-1", "candidate-1")).rejects.toThrow(
      "quota exceeded",
    );
    expect(regenerateCropMock).not.toHaveBeenCalled();

    const candidateUpdates = calls.filter(
      (call) => call.table === "import_job_candidates" && call.method === "update",
    );
    expect(candidateUpdates).toHaveLength(2);
    expect(candidateUpdates[1]!.args[0]).toEqual({
      status: "review_crop",
      crop_approved_at: null,
    });
  });
});
