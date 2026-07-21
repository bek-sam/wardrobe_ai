import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

type CandidateView = {
  crop_storage_path?: string | null;
  cutout_storage_path?: string | null;
  failed_cutout_storage_path?: string | null;
  modeled_storage_path?: string | null;
  [key: string]: unknown;
};

type JobView = {
  user_id: string;
  original_image_bucket: string;
  original_image_path: string;
  import_job_candidates?: CandidateView[] | null;
  [key: string]: unknown;
};

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
    (job.import_job_candidates ?? []).map(async (candidate) => {
      const entries = await Promise.all(
        [
          ["cropUrl", environment.WARDROBE_ORIGINALS_BUCKET, candidate.crop_storage_path],
          ["cutoutUrl", environment.WARDROBE_GENERATED_BUCKET, candidate.cutout_storage_path],
          [
            "failedCutoutUrl",
            environment.WARDROBE_GENERATED_BUCKET,
            candidate.failed_cutout_storage_path,
          ],
          ["modeledUrl", environment.WARDROBE_GENERATED_BUCKET, candidate.modeled_storage_path],
        ].map(async ([key, bucket, path]) => {
          if (typeof path !== "string") return [key, null] as const;
          const url = await createPrivateSignedUrl(
            client,
            bucket as string,
            path,
            job.user_id,
            expiresIn,
          );
          return [key, url] as const;
        }),
      );
      return { ...candidate, ...Object.fromEntries(entries) };
    }),
  );
  return {
    ...job,
    originalImageUrl,
    import_job_candidates: candidates,
    signedUrlExpiresIn: expiresIn,
  };
}
