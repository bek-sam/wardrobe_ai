import { beforeEach, describe, expect, it, vi } from "vitest";

const loadActiveCandidateMembersMock = vi.fn();
vi.mock("@/jobs/generate-outfit-previews/load-candidate-members", () => ({
  loadActiveCandidateMembers: (...args: unknown[]) => loadActiveCandidateMembersMock(...args),
}));

const verifyCutoutsAvailableMock = vi.fn();
vi.mock("@/jobs/generate-outfit-previews/verify-cutouts-available", () => ({
  verifyCutoutsAvailable: (...args: unknown[]) => verifyCutoutsAvailableMock(...args),
}));

const checkConsentAndQuotaMock = vi.fn();
vi.mock("@/jobs/generate-outfit-previews/check-consent-and-quota", () => ({
  checkConsentAndQuota: (...args: unknown[]) => checkConsentAndQuotaMock(...args),
}));

const renderAndStorePreviewMock = vi.fn();
vi.mock("@/jobs/generate-outfit-previews/render-and-store-preview", () => ({
  renderAndStorePreview: (...args: unknown[]) => renderAndStorePreviewMock(...args),
}));

const handlePreviewFailureMock = vi.fn();
vi.mock("@/jobs/generate-outfit-previews/handle-preview-failure", () => ({
  handlePreviewFailure: (...args: unknown[]) => handlePreviewFailureMock(...args),
}));

const JOB = {
  id: "job-1",
  user_id: "user-1",
  candidate_id: "candidate-1",
  source_hash: "h",
  attempt_count: 0,
};
const MEMBER_ROWS = [{ item_id: "item-1", role: "top", sort_order: 0 }];

describe("processClaimedOutfitPreviewJob: quota-consumed-before-cutout-check race (#9a)", () => {
  beforeEach(() => {
    loadActiveCandidateMembersMock.mockReset();
    verifyCutoutsAvailableMock.mockReset();
    checkConsentAndQuotaMock.mockReset();
    renderAndStorePreviewMock.mockReset();
    handlePreviewFailureMock.mockReset();
  });

  it("never consumes quota when a member item has no cutout yet", async () => {
    loadActiveCandidateMembersMock.mockResolvedValue(MEMBER_ROWS);
    const missingCutoutError = new Error("No cutout image found for item item-1.");
    verifyCutoutsAvailableMock.mockRejectedValue(missingCutoutError);

    const { processClaimedOutfitPreviewJob } =
      await import("@/jobs/generate-outfit-previews/process-claimed-job");
    const outcome = await processClaimedOutfitPreviewJob({} as never, {} as never, JOB as never);

    expect(outcome).toBe("failed");
    expect(checkConsentAndQuotaMock).not.toHaveBeenCalled();
    expect(renderAndStorePreviewMock).not.toHaveBeenCalled();
    expect(handlePreviewFailureMock).toHaveBeenCalledWith({}, JOB, missingCutoutError);
  });

  it("still consumes quota and renders when every member item has a cutout", async () => {
    loadActiveCandidateMembersMock.mockResolvedValue(MEMBER_ROWS);
    verifyCutoutsAvailableMock.mockResolvedValue(undefined);
    checkConsentAndQuotaMock.mockResolvedValue({ identityReferencePath: "path" });
    renderAndStorePreviewMock.mockResolvedValue(undefined);

    const { processClaimedOutfitPreviewJob } =
      await import("@/jobs/generate-outfit-previews/process-claimed-job");
    const outcome = await processClaimedOutfitPreviewJob({} as never, {} as never, JOB as never);

    expect(outcome).toBe("completed");
    expect(checkConsentAndQuotaMock).toHaveBeenCalledTimes(1);
    expect(renderAndStorePreviewMock).toHaveBeenCalledTimes(1);
  });
});
