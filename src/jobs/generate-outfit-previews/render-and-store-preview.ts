import { generateModeledPreview } from "@/lib/ai/image-service";
import { buildOutfitPreviewPrompt } from "@/lib/ai/prompts/outfit-preview";
import { downloadPrivateObject } from "@/lib/storage/private-images";

import { buildPreviewPromptInput } from "./build-preview-prompt-input";
import { loadPrimaryCutout } from "./load-primary-cutout";
import { storePreview } from "./store-preview";
import type {
  AdminClient,
  CandidateMemberRow,
  OutfitPreviewJobRow,
  ServerEnvironment,
} from "./types";

export async function renderAndStorePreview(
  admin: AdminClient,
  environment: ServerEnvironment,
  job: OutfitPreviewJobRow,
  memberRows: CandidateMemberRow[],
  identityReferencePath: string,
) {
  const identityReference = await downloadPrivateObject(
    admin,
    environment.PROFILE_REFERENCES_BUCKET,
    identityReferencePath,
    job.user_id,
  );
  const garmentCutouts = await Promise.all(
    memberRows.map((member) => loadPrimaryCutout(admin, job.user_id, member.item_id)),
  );
  const prompt = buildOutfitPreviewPrompt(
    await buildPreviewPromptInput(admin, memberRows, job.user_id),
  );
  const previewBytes = await generateModeledPreview({
    userId: job.user_id,
    identityReference,
    garmentCutouts,
    prompt,
  });

  await storePreview(admin, environment, job, previewBytes);
}
