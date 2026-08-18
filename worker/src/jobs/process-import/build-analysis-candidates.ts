import type { SupabaseClient } from "@supabase/supabase-js";

import { catalogGarments } from "@/lib/ai/agents/cataloging-agent";
import type { ServerEnvironment } from "@/lib/env/server";
import type { ValidatedImage } from "@/lib/image/validation";

import { buildCandidateItem, type ImportJobRow } from "./primitives";

export async function buildAnalysisCandidates(
  admin: SupabaseClient,
  environment: ServerEnvironment,
  job: ImportJobRow,
  normalized: ValidatedImage,
) {
  const catalog = await catalogGarments({
    image: normalized.bytes,
    mimeType: normalized.mimeType,
    userId: job.user_id,
    hint: job.input_metadata?.userHint,
  });

  const candidates = await Promise.all(
    catalog.result.garments.map((garment, ordinal) =>
      buildCandidateItem(
        admin,
        job,
        environment.WARDROBE_ORIGINALS_BUCKET,
        normalized.bytes,
        garment,
        ordinal,
      ),
    ),
  );

  return { catalog, candidates };
}
