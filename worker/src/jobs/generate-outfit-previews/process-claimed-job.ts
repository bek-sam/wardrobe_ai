import { checkConsentAndQuota } from "./check-consent-and-quota";
import { handlePreviewFailure } from "./handle-preview-failure";
import { loadActiveCandidateMembers } from "./load-candidate-members";
import { renderAndStorePreview } from "./render-and-store-preview";
import type {
  AdminClient,
  OutfitPreviewJobRow,
  PreviewJobOutcome,
  ServerEnvironment,
} from "./contracts";
import { verifyCutoutsAvailable } from "./verify-cutouts-available";

// Renders one already-claimed (status='running') outfit_preview_jobs row:
// validates the candidate is still active and the user still has active
// consent + a daily quota budget, downloads the identity reference + each
// member item's cutout, calls the (already-existing, now multi-garment)
// generateModeledPreview(), and stores the result under
// wardrobe-generated/{userId}/{candidateId}/preview-{uuid}.png. Shared by the
// service-role batch worker (processOutfitPreviewBatch) and the interactive
// owned-claim path (processOwnedOutfitPreviewJob) -- the caller is
// responsible for claiming the job first.
export async function processClaimedOutfitPreviewJob(
  admin: AdminClient,
  environment: ServerEnvironment,
  job: OutfitPreviewJobRow,
): Promise<PreviewJobOutcome> {
  try {
    const memberRows = await loadActiveCandidateMembers(admin, job);
    if (!memberRows) return "superseded";

    await verifyCutoutsAvailable(
      admin,
      job.user_id,
      memberRows.map((member) => member.item_id),
    );

    const consent = await checkConsentAndQuota(admin, environment, job);
    if (!consent) return "failed";

    await renderAndStorePreview(admin, environment, job, memberRows, consent.identityReferencePath);
    return "completed";
  } catch (error) {
    await handlePreviewFailure(admin, job, error);
    return "failed";
  }
}
