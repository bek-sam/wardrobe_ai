import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportJobRow } from "@/jobs/process-import/types";

const adminFromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

const isJobCancelledMock = vi.fn();
vi.mock("@/jobs/process-import/job-status", () => ({
  isJobCancelled: (...args: unknown[]) => isJobCancelledMock(...args),
}));

const extractCandidateMock = vi.fn();
vi.mock("@/jobs/process-import/extract-candidate", () => ({
  extractCandidate: (...args: unknown[]) => extractCandidateMock(...args),
}));

type FakeResult = { data: unknown; error: unknown };

function fakeQuery(initialResult: FakeResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  for (const method of ["update", "insert", "upsert", "select", "eq", "not", "in"]) {
    builder[method] = record(method);
  }
  builder.maybeSingle = () => {
    calls.push({ method: "maybeSingle", args: [] });
    return Promise.resolve(initialResult);
  };
  builder.then = (resolve: (value: FakeResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(initialResult).then(resolve, reject);
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
    ).resolves.toBeUndefined();

    const guard = jobsQuery.calls.find((call) => call.method === "not");
    expect(guard?.args).toEqual(cancelledGuardArgs);
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

  it("returns cancelled instead of the computed status when the guarded write matches no row", async () => {
    const { resolveNextJobStatus } = await import("@/jobs/process-import/resolve-next-status");
    const candidatesQuery = fakeQuery({ data: [{ status: "review_crop" }], error: null });
    const jobsQuery = fakeQuery({ data: null, error: null });
    const from = vi.fn((table: string) =>
      table === "import_job_candidates" ? candidatesQuery.builder : jobsQuery.builder,
    );
    const admin = { from } as never;

    const result = await resolveNextJobStatus(admin, JOB);

    expect(result).toBe("cancelled");
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
