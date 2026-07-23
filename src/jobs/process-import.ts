import { createHash } from "node:crypto";
import sharp from "sharp";
import { catalogGarments } from "@/lib/ai/agents/cataloging-agent";
import { extractGarment } from "@/lib/ai/image-service";
import { getServerEnvironment } from "@/lib/env/server";
import { cropDetectedItem } from "@/lib/image/crop";
import { validateAndNormalizeImage } from "@/lib/image/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadPrivateObject, uploadPrivateObject } from "@/lib/storage/private-images";

type ImportJobRow = {
  id: string;
  user_id: string;
  status: string;
  original_image_bucket: string;
  original_image_path: string;
  input_metadata: { userHint?: string | null } | null;
  attempt_count: number;
};

type ImportCandidateRow = {
  id: string;
  user_id: string;
  job_id: string;
  status: string;
  crop_storage_path: string | null;
  proposed_metadata: Record<string, unknown>;
  confirmed_metadata: Record<string, unknown>;
  regeneration_prompt: string | null;
  cleanup_tolerance: number;
  extraction_attempt_count: number;
};

function safeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown processing error";
  if (/too large|dimensions|format|empty|small|animated/i.test(message)) {
    return { code: "invalid_image", message };
  }
  if (/rate|quota/i.test(message)) {
    return { code: "provider_rate_limited", message: "AI processing is temporarily busy." };
  }
  return { code: "processing_failed", message: "The image could not be processed." };
}

export async function imageAssetMetadata(bytes: Buffer, generationModel?: string | null) {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Generated image metadata is invalid.");
  return {
    mime_type: "image/png",
    width: metadata.width,
    height: metadata.height,
    file_size: bytes.byteLength,
    ...(generationModel ? { generation_model: generationModel } : {}),
  };
}

function stableCandidateId(jobId: string, ordinal: number) {
  const hex = createHash("sha256").update(`${jobId}:${ordinal}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function loadJob(jobId: string, expectedUserId?: string): Promise<ImportJobRow> {
  const admin = createAdminClient();
  let query = admin.from("import_jobs").select("*").eq("id", jobId);
  if (expectedUserId) query = query.eq("user_id", expectedUserId);
  const { data, error } = await query.single();
  if (error || !data) throw error ?? new Error("Import job not found.");
  return data as ImportJobRow;
}

async function analyzeJob(job: ImportJobRow) {
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  await admin
    .from("import_jobs")
    .update({
      status: "analyzing",
      progress: 10,
      attempt_count: job.status === "analyzing" ? job.attempt_count : job.attempt_count + 1,
      processing_started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .in("status", ["queued", "failed", "analyzing"]);

  const original = await downloadPrivateObject(
    admin,
    job.original_image_bucket,
    job.original_image_path,
    job.user_id,
  );
  const normalized = await validateAndNormalizeImage(original);
  await uploadPrivateObject(
    admin,
    job.original_image_bucket,
    job.original_image_path,
    job.user_id,
    normalized.bytes,
    normalized.mimeType,
  );
  const catalog = await catalogGarments({
    image: normalized.bytes,
    mimeType: normalized.mimeType,
    userId: job.user_id,
    hint: job.input_metadata?.userHint,
  });

  const candidates = await Promise.all(
    catalog.result.garments.map(async (garment, ordinal) => {
      const candidateId = stableCandidateId(job.id, ordinal);
      const crop = await cropDetectedItem(normalized.bytes, garment.boundingBox);
      const cropPath = `${job.user_id}/${job.id}/candidates/${candidateId}/crop.png`;
      const cropAssetMetadata = await imageAssetMetadata(crop);
      await uploadPrivateObject(
        admin,
        environment.WARDROBE_ORIGINALS_BUCKET,
        cropPath,
        job.user_id,
        crop,
        "image/png",
      );
      return {
        id: candidateId,
        user_id: job.user_id,
        job_id: job.id,
        ordinal,
        status: "review_crop",
        bounding_box: garment.boundingBox,
        proposed_metadata: {
          name: garment.suggestedName,
          category: garment.category,
          subcategory: garment.subcategory,
          primary_color_hex: garment.primaryColorHex,
          secondary_color_hex: garment.secondaryColorHex,
          color_names: garment.colorNames,
          pattern: garment.pattern,
          silhouette: garment.silhouette,
          materials: garment.apparentMaterial
            ? { apparent: garment.apparentMaterial, inferred: true }
            : {},
          visible_text: garment.visibleText,
          season_tags: garment.seasonSuggestions,
          occasion_tags: garment.occasionSuggestions,
          notes: "",
        },
        field_confidence: garment.fieldConfidence,
        crop_storage_path: cropPath,
        crop_asset_metadata: cropAssetMetadata,
      };
    }),
  );

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
    .eq("user_id", job.user_id);

  await admin.from("agent_runs").insert({
    user_id: job.user_id,
    agent_type: "cataloging",
    status: "complete",
    input_summary: { importJobId: job.id },
    output_summary: { candidateCount: candidates.length, responseId: catalog.responseId },
    model: environment.OPENAI_VISION_MODEL,
    usage: catalog.usage ?? {},
  });
  return candidates.length;
}

async function extractCandidate(candidate: ImportCandidateRow) {
  if (!candidate.crop_storage_path) throw new Error("The approved crop is missing.");
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const crop = await downloadPrivateObject(
    admin,
    environment.WARDROBE_ORIGINALS_BUCKET,
    candidate.crop_storage_path,
    candidate.user_id,
  );
  const metadata = { ...candidate.proposed_metadata, ...candidate.confirmed_metadata };
  const extraction = await extractGarment({
    userId: candidate.user_id,
    crop,
    metadata: {
      name: typeof metadata.name === "string" ? metadata.name : null,
      category: typeof metadata.category === "string" ? metadata.category : null,
      primaryColorHex:
        typeof metadata.primary_color_hex === "string" ? metadata.primary_color_hex : null,
      secondaryColorHex:
        typeof metadata.secondary_color_hex === "string" ? metadata.secondary_color_hex : null,
      visibleDetails: Array.isArray(metadata.visible_text)
        ? metadata.visible_text.filter((value): value is string => typeof value === "string")
        : [],
    },
    regenerationInstruction: candidate.regeneration_prompt,
    cleanupTolerance: candidate.cleanup_tolerance,
  });
  const basePath = `${candidate.user_id}/${candidate.job_id}/candidates/${candidate.id}`;
  const rawPath = `${basePath}/cutout-source-${candidate.extraction_attempt_count + 1}.png`;
  const cutoutPath = `${basePath}/cutout-${candidate.extraction_attempt_count + 1}.png`;
  const cutoutAssetMetadata = await imageAssetMetadata(
    extraction.cutout,
    environment.OPENAI_IMAGE_MODEL,
  );
  await Promise.all([
    uploadPrivateObject(
      admin,
      environment.WARDROBE_GENERATED_BUCKET,
      rawPath,
      candidate.user_id,
      extraction.rawSource,
      "image/png",
    ),
    uploadPrivateObject(
      admin,
      environment.WARDROBE_GENERATED_BUCKET,
      cutoutPath,
      candidate.user_id,
      extraction.cutout,
      "image/png",
    ),
  ]);
  const { error } = await admin
    .from("import_job_candidates")
    .update({
      status: "review_cutout",
      cutout_storage_path: cutoutPath,
      failed_cutout_storage_path: rawPath,
      chroma_key: extraction.chromaKey,
      cleanup_diagnostics: extraction.cleanup,
      cutout_asset_metadata: cutoutAssetMetadata,
      extraction_attempt_count: candidate.extraction_attempt_count + 1,
      error_code: null,
      error_message: null,
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id)
    .eq("status", "extracting");
  if (error) throw error;
}

export async function processImportJob(jobId: string, expectedUserId?: string) {
  const job = await loadJob(jobId, expectedUserId);
  try {
    if (["queued", "failed", "analyzing"].includes(job.status)) {
      const candidateCount = await analyzeJob(job);
      if (candidateCount === 0) return { jobId: job.id, status: "failed" };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("import_job_candidates")
      .select("*")
      .eq("job_id", job.id)
      .eq("user_id", job.user_id)
      .eq("status", "extracting");
    if (error) throw error;
    for (const candidate of (data ?? []) as ImportCandidateRow[]) {
      try {
        await extractCandidate(candidate);
      } catch (error) {
        const failure = safeFailure(error);
        await admin
          .from("import_job_candidates")
          .update({ status: "failed", error_code: failure.code, error_message: failure.message })
          .eq("id", candidate.id)
          .eq("user_id", candidate.user_id);
      }
    }

    const { data: remaining } = await admin
      .from("import_job_candidates")
      .select("status")
      .eq("job_id", job.id)
      .eq("user_id", job.user_id);
    const statuses = (remaining ?? []).map((candidate) => candidate.status as string);
    const nextStatus = statuses.some((status) => status === "extracting")
      ? "extracting"
      : statuses.some((status) => status === "review_crop")
        ? "review_crop"
        : "review_metadata";
    await admin
      .from("import_jobs")
      .update({
        status: nextStatus,
        progress: nextStatus === "review_metadata" ? 70 : 50,
        locked_at: null,
        locked_until: null,
        next_attempt_at: null,
      })
      .eq("id", job.id)
      .eq("user_id", job.user_id)
      .neq("status", "complete");
    return { jobId: job.id, status: nextStatus };
  } catch (error) {
    const failure = safeFailure(error);
    const admin = createAdminClient();
    await admin
      .from("import_jobs")
      .update({
        status: "failed",
        error_code: failure.code,
        error_message: failure.message,
        locked_at: null,
        locked_until: null,
        next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
      })
      .eq("id", job.id)
      .eq("user_id", job.user_id);
    throw error;
  }
}
