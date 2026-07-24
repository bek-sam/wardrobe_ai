import type { SupabaseClient } from "@supabase/supabase-js";

import type { catalogGarments } from "@/lib/ai/agents/cataloging-agent";
import type { ServerEnvironment } from "@/lib/env/server";
import type { ValidatedImage } from "@/lib/image/validation";

import type { ImportJobRow } from "./types";

export async function persistAnalysisResults(
  admin: SupabaseClient,
  environment: ServerEnvironment,
  job: ImportJobRow,
  normalized: ValidatedImage,
  catalog: Awaited<ReturnType<typeof catalogGarments>>,
  candidates: readonly Record<string, unknown>[],
) {
  if (candidates.length > 0) {
    const { error } = await admin
      .from("import_job_candidates")
      .upsert(candidates, { onConflict: "job_id,ordinal" });
    if (error) throw error;
  }

  await admin
    .from("import_jobs")
    .update({
      status: candidates.length > 0 ? "review_crop" : "failed",
      progress: candidates.length > 0 ? 35 : 100,
      original_mime_type: normalized.mimeType,
      original_width: normalized.width,
      original_height: normalized.height,
      original_file_size: normalized.bytes.byteLength,
      completed_at: candidates.length > 0 ? null : new Date().toISOString(),
      error_code: candidates.length > 0 ? null : "no_garments_detected",
      error_message:
        candidates.length > 0
          ? null
          : "No distinct garments were detected. Try a clearer or closer photo.",
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .not("status", "in", "(complete,cancelled)");

  await admin.from("agent_runs").insert({
    user_id: job.user_id,
    agent_type: "cataloging",
    status: "complete",
    input_summary: { importJobId: job.id },
    output_summary: { candidateCount: candidates.length, responseId: catalog.responseId },
    model: environment.OPENAI_VISION_MODEL,
    usage: catalog.usage ?? {},
  });
}
