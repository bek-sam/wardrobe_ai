import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { withSignedImportUrls } from "@/features/intake/server/job-view";
import type { createImportJobSchema } from "@/features/intake/schemas/import-job";
import { getServerEnvironment } from "@/lib/env/server";
import { assertOwnedStoragePath } from "@/lib/storage/private-images";

import { enqueueImportJob } from "./enqueue-import-job";
import { resolveIdempotencyKey } from "./resolve-idempotency-key";

type CreateImportJobInput = z.infer<typeof createImportJobSchema>;

export async function handleCreateImportJob(
  supabase: SupabaseClient,
  userId: string,
  input: CreateImportJobInput,
  idempotencyKeyHeader: string | null,
) {
  assertOwnedStoragePath(input.originalImagePath, userId);
  const environment = getServerEnvironment();
  const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader, input.idempotencyKey);

  const data = await enqueueImportJob(
    supabase,
    environment,
    userId,
    input.originalImagePath,
    input.userHint,
    idempotencyKey,
  );

  const replayed = Boolean(
    typeof data === "object" && data && "already_enqueued" in data && data.already_enqueued,
  );
  const job = await withSignedImportUrls(supabase, data);

  return { job, replayed, jobId: String(data.id) };
}
