import type { SupabaseClient } from "@supabase/supabase-js";

import type { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

import type { CandidateView } from "./job-view.types";

export async function signCandidateUrls(
  client: SupabaseClient,
  candidate: CandidateView,
  userId: string,
  environment: ReturnType<typeof getServerEnvironment>,
  expiresIn: number,
) {
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
      const url = await createPrivateSignedUrl(client, bucket as string, path, userId, expiresIn);
      return [key, url] as const;
    }),
  );
  return { ...candidate, ...Object.fromEntries(entries) };
}
