import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportJobRow } from "@/jobs/process-import/types";

const adminFromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

const isJobCancelledMock = vi.fn();
vi.mock("@/jobs/process-import/job-status", () => ({
  isJobCancelled: (...args: unknown[]) => isJobCancelledMock(...args),
  excludeTerminalJobStatuses: (query: { not: (...args: unknown[]) => unknown }) =>
    query.not("status", "in", "(complete,cancelled)"),
}));

const extractCandidateMock = vi.fn();
vi.mock("@/jobs/process-import/extract-candidate", () => ({
  extractCandidate: (...args: unknown[]) => extractCandidateMock(...args),
}));

type FakeResult = { data: unknown; error: unknown };

const QUERY_METHODS = ["update", "insert", "upsert", "select", "eq", "not", "in", "is"];

function fakeQuery(initialResult: FakeResult) {
  return sequentialFakeQuery([initialResult]);
}

function sequentialFakeQuery(results: FakeResult[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  for (const method of QUERY_METHODS) {
    builder[method] = record(method);
  }
  let index = 0;
  builder.maybeSingle = () => {
    calls.push({ method: "maybeSingle", args: [] });
    const result = results[Math.min(index, results.length - 1)];
    index += 1;
    return Promise.resolve(result);
  };
  const firstResult = results[0] as FakeResult;
  builder.then = (resolve: (value: FakeResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(firstResult).then(resolve, reject);
  return { builder, calls };
}

const JOB: ImportJobRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  status: "analyzing",
  original_image_bucket: "wardrobe-originals",
  original_image_path: "22222222-2222-4222-8222-222222222222/original.jpg",
  input_metadata: null,
  attempt_count: 0,
  locked_until: null,
};

const cancelledGuardArgs = ["status", "in", "(complete,cancelled)"];

beforeEach(() => {
  adminFromMock.mockReset();
  isJobCancelledMock.mockReset();
  extractCandidateMock.mockReset();
});

describe("persistAnalysisResults", () => {
  it("guards the import_jobs write and does not throw when the job was cancelled underneath it", async () => {
    const { persistAnalysisResults } =
      await import("@/jobs/process-import/persist-analysis-results");
    const jobsQuery = fakeQuery({ data: null, error: null });
    const agentRunsQuery = fakeQuery({ data: null, error: null });
    const from = vi.fn((table: string) =>
      table === "import_jobs" ? jobsQuery.builder : agentRunsQuery.builder,
    );
    const admin = { from } as never;

    await expect(
      persistAnalysisResults(
        admin,
        { OPENAI_VISION_MODEL: "test-model" } as never,
        JOB,
        { mimeType: "image/jpeg", width: 100, height: 100, bytes: new Uint8Array(4) } as never,
        { responseId: "resp_1", usage: {} } as never,
        [],
      ),
    ).resolves.toBe(0);

    const guard = jobsQuery.calls.find((call) => call.method === "not");
    expect(guard?.args).toEqual(cancelledGuardArgs);
  });

  it("returns null and skips the candidate upsert when the job was already cancelled", async () => {
    const { persistAnalysisResults } =
      await import("@/jobs/process-import/persist-analysis-results");
    isJobCancelledMock.mockResolvedValue(true);
    const from = vi.fn();
    const admin = { from } as never;

    const result = await persistAnalysisResults(
      admin,
      { OPENAI_VISION_MODEL: "test-model" } as never,
      JOB,
      { mimeType: "image/jpeg", width: 100, height: 100, bytes: new Uint8Array(4) } as never,
      { responseId: "resp_1", usage: {} } as never,
      [{ ordinal: 0 }],
    );

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("resolveNextJobStatus", () => {
  it("guards the import_jobs write with not(status in (complete,cancelled))", async () => {
    const { resolveNextJobStatus } = await import("@/jobs/process-import/resolve-next-status");
    const candidatesQuery = fakeQuery({ data: [{ status: "review_crop" }], error: null });
    const jobsQuery = fakeQuery({ data: { id: JOB.id }, error: null });
    const from = vi.fn((table: string) =>
      table === "import_job_candidates" ? candidatesQuery.builder : jobsQuery.builder,
    );
    const admin = { from } as never;

    const result = await resolveNextJobStatus(admin, JOB);

    expect(result).toBe("review_crop");
    const guard = jobsQuery.calls.find((call) => call.method === "not");
    expect(guard?.args).toEqual(cancelledGuardArgs);
  });

  it("returns cancelled when the guarded write matches no row and the job is actually cancelled", async () => {
    const { resolveNextJobStatus } = await import("@/jobs/process-import/resolve-next-status");
    const candidatesQuery = fakeQuery({ data: [{ status: "review_crop" }], error: null });
    const jobsQuery = sequentialFakeQuery([
      { data: null, error: null },
      { data: { status: "cancelled" }, error: null },
    ]);
    const from = vi.fn((table: string) =>
      table === "import_job_candidates" ? candidatesQuery.builder : jobsQuery.builder,
    );
    const admin = { from } as never;

    const result = await resolveNextJobStatus(admin, JOB);

    expect(result).toBe("cancelled");
  });

  it("returns the job's actual terminal status instead of misreporting cancelled when a concurrent worker already completed it", async () => {
    const { resolveNextJobStatus } = await import("@/jobs/process-import/resolve-next-status");
    const candidatesQuery = fakeQuery({ data: [{ status: "review_crop" }], error: null });
    const jobsQuery = sequentialFakeQuery([
      { data: null, error: null },
      { data: { status: "complete" }, error: null },
    ]);
    const from = vi.fn((table: string) =>
      table === "import_job_candidates" ? candidatesQuery.builder : jobsQuery.builder,
    );
    const admin = { from } as never;

    const result = await resolveNextJobStatus(admin, JOB);

    expect(result).toBe("complete");
  });
});

describe("markJobAnalyzing", () => {
  it("reports whether it claimed the job", async () => {
    const { markJobAnalyzing } = await import("@/jobs/process-import/mark-job-analyzing");

    const claimed = fakeQuery({ data: { id: JOB.id }, error: null });
    const notClaimed = fakeQuery({ data: null, error: null });

    await expect(markJobAnalyzing({ from: () => claimed.builder } as never, JOB)).resolves.toBe(
      true,
    );
    await expect(markJobAnalyzing({ from: () => notClaimed.builder } as never, JOB)).resolves.toBe(
      false,
    );
  });

  it("fails the compare-and-swap when locked_until no longer matches the loaded snapshot", async () => {
    const { markJobAnalyzing } = await import("@/jobs/process-import/mark-job-analyzing");

    const notClaimed = fakeQuery({ data: null, error: null });
    const staleJob: ImportJobRow = { ...JOB, locked_until: "2026-07-24T00:00:00.000Z" };

    const claimed = await markJobAnalyzing({ from: () => notClaimed.builder } as never, staleJob);

    expect(claimed).toBe(false);
    const lockedUntilGuard = notClaimed.calls.find(
      (call) => call.method === "eq" && call.args[0] === "locked_until",
    );
    expect(lockedUntilGuard?.args).toEqual(["locked_until", staleJob.locked_until]);
  });
});

describe("failJob", () => {
  it("guards the failure write and does not throw when the job was already cancelled", async () => {
    const { failJob } = await import("@/jobs/process-import/fail-job");
    const jobsQuery = fakeQuery({ data: null, error: null });
    adminFromMock.mockReturnValue(jobsQuery.builder);

    await expect(failJob(JOB, new Error("boom"))).resolves.toBeUndefined();

    const guard = jobsQuery.calls.find((call) => call.method === "not");
    expect(guard?.args).toEqual(cancelledGuardArgs);
  });
});

describe("extractPendingCandidates", () => {
  it("skips processing entirely when the job has already been cancelled", async () => {
    const { extractPendingCandidates } =
      await import("@/jobs/process-import/extract-pending-candidates");
    isJobCancelledMock.mockResolvedValue(true);
    const from = vi.fn();
    const admin = { from } as never;

    await extractPendingCandidates(admin, JOB);

    expect(from).not.toHaveBeenCalled();
    expect(extractCandidateMock).not.toHaveBeenCalled();
  });

  it("processes pending candidates when the job is still active", async () => {
    const { extractPendingCandidates } =
      await import("@/jobs/process-import/extract-pending-candidates");
    isJobCancelledMock.mockResolvedValue(false);
    extractCandidateMock.mockResolvedValue(undefined);
    const candidatesQuery = fakeQuery({
      data: [{ id: "c1", user_id: JOB.user_id, status: "extracting" }],
      error: null,
    });
    const admin = { from: () => candidatesQuery.builder } as never;

    await extractPendingCandidates(admin, JOB);

    expect(extractCandidateMock).toHaveBeenCalledTimes(1);
  });
});
