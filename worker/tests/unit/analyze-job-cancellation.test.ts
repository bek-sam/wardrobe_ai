import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({ AI_CATALOG_POLICY_VERSION: "catalog@test" }),
}));

const markJobAnalyzingMock = vi.fn();
vi.mock("@/jobs/process-import/mark-job-analyzing", () => ({
  markJobAnalyzing: (...args: unknown[]) => markJobAnalyzingMock(...args),
}));

const downloadAndNormalizeOriginalMock = vi.fn();
vi.mock("@/jobs/process-import/download-and-normalize-original", () => ({
  downloadAndNormalizeOriginal: (...args: unknown[]) => downloadAndNormalizeOriginalMock(...args),
}));

const buildAnalysisCandidatesMock = vi.fn();
vi.mock("@/jobs/process-import/build-analysis-candidates", () => ({
  buildAnalysisCandidates: (...args: unknown[]) => buildAnalysisCandidatesMock(...args),
}));

const persistAnalysisResultsMock = vi.fn();
vi.mock("@/jobs/process-import/persist-analysis-results", () => ({
  persistAnalysisResults: (...args: unknown[]) => persistAnalysisResultsMock(...args),
}));

const JOB = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  status: "analyzing",
  original_image_bucket: "wardrobe-originals",
  original_image_path: "22222222-2222-4222-8222-222222222222/original.jpg",
  input_metadata: null,
  attempt_count: 0,
};

beforeEach(() => {
  markJobAnalyzingMock.mockReset();
  downloadAndNormalizeOriginalMock.mockReset();
  buildAnalysisCandidatesMock.mockReset();
  persistAnalysisResultsMock.mockReset();
});

describe("analyzeJob", () => {
  it("returns null without downloading or calling the model when the job could not be claimed", async () => {
    const { analyzeJob } = await import("@/jobs/process-import/support");
    markJobAnalyzingMock.mockResolvedValue(false);

    const result = await analyzeJob(JOB as never);

    expect(result).toBeNull();
    expect(downloadAndNormalizeOriginalMock).not.toHaveBeenCalled();
    expect(buildAnalysisCandidatesMock).not.toHaveBeenCalled();
    expect(persistAnalysisResultsMock).not.toHaveBeenCalled();
  });

  it("proceeds through analysis when the job was claimed", async () => {
    const { analyzeJob } = await import("@/jobs/process-import/support");
    markJobAnalyzingMock.mockResolvedValue(true);
    downloadAndNormalizeOriginalMock.mockResolvedValue({ mimeType: "image/jpeg" });
    buildAnalysisCandidatesMock.mockResolvedValue({
      catalog: { responseId: "resp_1", usage: {} },
      candidates: [{}, {}],
    });
    persistAnalysisResultsMock.mockResolvedValue(2);

    const result = await analyzeJob(JOB as never);

    expect(result).toBe(2);
    expect(persistAnalysisResultsMock).toHaveBeenCalledTimes(1);
  });
});
