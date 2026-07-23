import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

import type { JobView } from "./job-view.types";
import { signCandidateUrls } from "./sign-candidate-urls";

export async function withSignedImportUrls(client: SupabaseClient, job: JobView) {
  const environment = getServerEnvironment();
  const expiresIn = environment.SIGNED_URL_TTL_SECONDS;
  const originalImageUrl = await createPrivateSignedUrl(
    client,
    job.original_image_bucket,
    job.original_image_path,
    job.user_id,
    expiresIn,
  );
  const candidates = await Promise.all(
    (job.import_job_candidates ?? []).map((candidate) =>
      signCandidateUrls(client, candidate, job.user_id, environment, expiresIn),
    ),
  );
  return {
    ...job,
    originalImageUrl,
    import_job_candidates: candidates,
    signedUrlExpiresIn: expiresIn,
  };
}
