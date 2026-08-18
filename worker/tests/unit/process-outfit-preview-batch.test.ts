import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({}),
}));

const processClaimedMock = vi.fn();
vi.mock("@/jobs/generate-outfit-previews/process-claimed-job", () => ({
  processClaimedOutfitPreviewJob: (...args: unknown[]) => processClaimedMock(...args),
}));

const JOBS = [1, 2, 3].map((n) => ({
  id: `job-${n}`,
  user_id: "user-1",
  candidate_id: `candidate-${n}`,
  source_hash: "hash",
  attempt_count: 0,
}));

describe("processOutfitPreviewBatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rpcMock.mockReset();
    processClaimedMock.mockReset();
    rpcMock.mockResolvedValue({ data: JOBS, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("claims a small, bounded batch with a 300s lease", async () => {
    processClaimedMock.mockResolvedValue("completed");
    const { processOutfitPreviewBatch } = await import("@/jobs/generate-outfit-previews");
    await processOutfitPreviewBatch(Date.now(), 100_000);
    expect(rpcMock).toHaveBeenCalledWith("claim_outfit_preview_jobs", {
      p_limit: 3,
      p_lease_seconds: 300,
    });
  });

  it("processes every claimed job when within budget", async () => {
    processClaimedMock.mockResolvedValue("completed");
    const { processOutfitPreviewBatch } = await import("@/jobs/generate-outfit-previews");
    const result = await processOutfitPreviewBatch(Date.now(), 100_000);
    expect(result).toEqual({ claimed: 3, completed: 3, failed: 0, superseded: 0, skipped: 0 });
    expect(processClaimedMock).toHaveBeenCalledTimes(3);
  });

  it("stops before the execution budget is exceeded, leaving the rest for a future invocation", async () => {
    let calls = 0;
    processClaimedMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) vi.advanceTimersByTime(200);
      return "completed";
    });
    const { processOutfitPreviewBatch } = await import("@/jobs/generate-outfit-previews");
    const result = await processOutfitPreviewBatch(Date.now(), 100);
    expect(result).toEqual({ claimed: 3, completed: 1, failed: 0, superseded: 0, skipped: 2 });
    expect(processClaimedMock).toHaveBeenCalledTimes(1);
  });

  it("skips claiming entirely when the budget is already exhausted, leaving no lease to waste", async () => {
    const { processOutfitPreviewBatch } = await import("@/jobs/generate-outfit-previews");
    const startedAt = Date.now();
    vi.advanceTimersByTime(200);

    const result = await processOutfitPreviewBatch(startedAt, 100);

    expect(result).toEqual({ claimed: 0, completed: 0, failed: 0, superseded: 0, skipped: 0 });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(processClaimedMock).not.toHaveBeenCalled();
  });
});
