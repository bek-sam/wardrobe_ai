import type {
  GeneratedVisualizationImage,
  OutfitVisualizationProvider,
  VisualizationGarmentInput,
} from "@/lib/ai/visualization-provider";
import { VisualizationProviderError } from "@/lib/ai/visualization-provider";
import { evaluateQaGate, type VisualizationAssessment } from "@/lib/visualization";
import type { OutfitItemRole } from "@/features/outfits";
import { normalizeVisualizationProviderError } from "@/lib/ai/visualization-provider";
import { downloadPrivateObject } from "@/lib/storage/private-images";
import {
  buildSnapshotHotspots,
  VISUALIZATION_ROLE_Z_INDEX,
  type GarmentHotspot,
} from "@/lib/visualization";
import { randomUUID } from "node:crypto";
import { getServerEnvironment } from "@/lib/env/server";
import { uploadPrivateObject } from "@/lib/storage/private-images";
import { resolveVisualizationProvider } from "@/lib/ai/visualization-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export type QaAcceptedImage = {
  image: GeneratedVisualizationImage;
  assessment: VisualizationAssessment;
  correctionUsed: boolean;
};

type Attempt = { userId: string; identity: Buffer; garments: readonly VisualizationGarmentInput[] };

/**
 * Generates, gates, and — at most once — regenerates with the specific
 * structured failures fed back into the prompt. A second rejection is never
 * exposed as ready: it throws a `qa_rejected` error carrying the assessment's
 * safe summary, which the caller stores as a terminal failure.
 *
 * Transient transport failures are a separate concern handled by the job's own
 * retry budget; this only ever spends the one *content* correction.
 */
export async function generateWithQaGate(
  provider: OutfitVisualizationProvider,
  attempt: Attempt,
  correctionsAlreadyUsed: number,
  onStage: (stage: "generating" | "qa_review") => Promise<unknown> = async () => undefined,
): Promise<QaAcceptedImage> {
  let corrections: string[] = [];

  for (let round = 0; round <= 1; round += 1) {
    await onStage("generating");
    const image = await provider.generate({ ...attempt, correctionInstructions: corrections });
    await onStage("qa_review");
    const assessment = await provider.assess({ ...attempt, image: image.bytes });
    const gate = evaluateQaGate(assessment);

    if (gate.verdict === "pass") {
      return { image, assessment, correctionUsed: round > 0 };
    }
    const canCorrect =
      gate.verdict === "correctable" && round === 0 && correctionsAlreadyUsed === 0;
    if (!canCorrect) {
      throw new VisualizationProviderError(
        "qa_rejected",
        assessment.safeSummary ||
          (gate.reasons[0] ?? "The try-on did not pass the fidelity check."),
        image.requestId,
      );
    }
    corrections = [...gate.reasons, ...assessment.correctionInstructions];
  }

  throw new VisualizationProviderError(
    "qa_rejected",
    "The try-on did not pass the fidelity check.",
  );
}

export type AdminClient = ReturnType<typeof createAdminClient>;

export type ServerEnvironment = ReturnType<typeof getServerEnvironment>;

export type VisualizationJobRow = {
  id: string;
  visualization_id: string;
  user_id: string;
  attempt_count: number;
  max_attempts: number;
};

export type VisualizationRow = {
  id: string;
  user_id: string;
  status: string;
  identity_reference_id: string;
  corrective_attempt_count: number;
};

export type SnapshotItemRow = {
  item_id: string;
  role: OutfitItemRole;
  sort_order: number;
  cutout_bucket_id: string;
  cutout_storage_path: string;
};

export type VisualizationJobOutcome = "completed" | "failed" | "superseded";

/** Bounded exponential backoff, mirroring the other durable workers. */
export function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(30 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}

/**
 * Records a failure with a bounded code and a safe summary. Nothing here logs
 * the prompt, the image bytes, a signed URL, or a storage path — a provider
 * error object can echo the whole request body, which is exactly the private
 * data that must not reach a log line.
 */
export async function handleVisualizationFailure(
  admin: AdminClient,
  job: VisualizationJobRow,
  error: unknown,
) {
  const normalized = normalizeVisualizationProviderError(error);
  const retryable = normalized.retryable && job.attempt_count < job.max_attempts;

  console.error("Outfit visualization failed", {
    jobId: job.id,
    visualizationId: job.visualization_id,
    errorCode: normalized.code,
    attempt: job.attempt_count,
    retryable,
    requestId: normalized.requestId,
  });

  try {
    await admin.rpc("fail_outfit_visualization", {
      p_job_id: job.id,
      p_user_id: job.user_id,
      p_error_code: normalized.code,
      p_error_summary: normalized.safeSummary,
      p_retryable: retryable,
      p_next_attempt_at: retryable ? retryAt(job.attempt_count) : null,
      p_qa_summary: null,
      p_request_id: normalized.requestId,
    });
  } catch {
    // Best-effort bookkeeping; the lease expiring is the backstop.
  }
}

/**
 * Downloads each snapshot cutout and pairs it with the item's *confirmed*
 * wardrobe facts. imageNumber starts at 2 because Image 1 is always the
 * identity reference — the prompt builder and the provider payload rely on
 * exactly this numbering, so it is assigned once, here.
 */
export async function loadGarmentInputs(
  admin: AdminClient,
  userId: string,
  items: readonly SnapshotItemRow[],
): Promise<VisualizationGarmentInput[]> {
  const ordered = [...items].sort((first, second) => first.sort_order - second.sort_order);
  const { data: rows } = await admin
    .from("wardrobe_items")
    .select("id, name, color_names, pattern, fit, silhouette, materials")
    .eq("user_id", userId)
    .in(
      "id",
      ordered.map((item) => item.item_id),
    );
  const byId = new Map((rows ?? []).map((row) => [row.id as string, row]));

  return Promise.all(
    ordered.map(async (item, index) => {
      const row = byId.get(item.item_id);
      const materials = row?.materials;
      return {
        imageNumber: index + 2,
        itemId: item.item_id,
        role: item.role,
        name: (row?.name as string | undefined) ?? "wardrobe item",
        colorNames: (row?.color_names as string[] | undefined) ?? [],
        pattern: (row?.pattern as string | null | undefined) ?? null,
        fit: (row?.fit as string | null | undefined) ?? null,
        silhouette: (row?.silhouette as string | null | undefined) ?? null,
        materials: Array.isArray(materials) ? materials.map(String).slice(0, 4) : [],
        cutout: await downloadPrivateObject(
          admin,
          item.cutout_bucket_id,
          item.cutout_storage_path,
          userId,
        ),
      };
    }),
  );
}

export type JobContext = {
  visualization: VisualizationRow;
  items: SnapshotItemRow[];
  identity: Buffer;
};

/**
 * Loads everything the render needs, re-reading each row scoped to the job's
 * own user rather than trusting anything the claim RPC returned. Returns null
 * when the visualization or its identity reference is gone or no longer
 * active, which the caller treats as superseded rather than failed.
 */
export async function loadJobContext(
  admin: AdminClient,
  job: VisualizationJobRow,
): Promise<JobContext | null> {
  const { data: visualization } = await admin
    .from("outfit_visualizations")
    .select("id, user_id, status, identity_reference_id, corrective_attempt_count")
    .eq("id", job.visualization_id)
    .eq("user_id", job.user_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!visualization || visualization.status === "superseded") return null;

  const { data: reference } = await admin
    .from("profile_identity_references")
    .select("bucket_id, storage_path")
    .eq("id", visualization.identity_reference_id)
    .eq("user_id", job.user_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!reference) return null;

  const { data: items } = await admin
    .from("outfit_visualization_items")
    .select("item_id, role, sort_order, cutout_bucket_id, cutout_storage_path")
    .eq("visualization_id", job.visualization_id)
    .eq("user_id", job.user_id)
    .order("sort_order", { ascending: true });
  if (!items || items.length === 0) return null;

  return {
    visualization: visualization as VisualizationRow,
    items: items as SnapshotItemRow[],
    identity: await downloadPrivateObject(
      admin,
      reference.bucket_id as string,
      reference.storage_path as string,
      job.user_id,
    ),
  };
}

/**
 * Localization is best-effort by design. A failure, an empty result, or a
 * low-confidence region degrades to the deterministic body zone; the garment
 * chip list is unaffected either way, so the feature stays fully usable even
 * when every hotspot is approximate.
 */
export async function locateGarmentHotspots(
  provider: OutfitVisualizationProvider,
  input: {
    userId: string;
    image: Buffer;
    identity: Buffer;
    garments: readonly VisualizationGarmentInput[];
  },
): Promise<GarmentHotspot[]> {
  const located = await provider
    .localize(input)
    .then((result) =>
      result.regions.map((region): GarmentHotspot => ({
        version: 1,
        itemId: region.itemId,
        role: region.role,
        shape: "rect",
        bounds: region.bounds,
        confidence: region.confidence,
        // Never "user_corrected": a model region is a proposal, and calling
        // it confirmed would let generated pixels masquerade as user intent.
        source: "model",
        zIndex: VISUALIZATION_ROLE_Z_INDEX[region.role],
      })),
    )
    .catch(() => []);

  const supplied = new Set(input.garments.map((garment) => garment.itemId));
  return buildSnapshotHotspots(
    input.garments.map(({ itemId, role }) => ({ itemId, role })),
    located.filter((hotspot) => supplied.has(hotspot.itemId)),
  );
}

/** Safe QA summary only: verdicts and one short sentence, never image bytes. */
function safeQaSummary(assessment: VisualizationAssessment, correctionUsed: boolean) {
  return {
    verdict: assessment.verdict,
    identity: assessment.identity.recognizableMatch,
    framing: assessment.framing,
    anatomy: assessment.anatomy.verdict,
    garments: assessment.garments.map(({ itemId, role, present }) => ({ itemId, role, present })),
    extraGarmentCount: assessment.extraGarments.length,
    correctionUsed,
    summary: assessment.safeSummary,
  };
}

export async function storeVisualizationResult(
  admin: AdminClient,
  job: VisualizationJobRow,
  result: {
    image: GeneratedVisualizationImage;
    assessment: VisualizationAssessment;
    correctionUsed: boolean;
    hotspots: readonly GarmentHotspot[];
  },
) {
  const bucket = getServerEnvironment().WARDROBE_GENERATED_BUCKET;
  const path = `${job.user_id}/visualizations/${job.visualization_id}/${randomUUID()}.png`;
  await uploadPrivateObject(admin, bucket, path, job.user_id, result.image.bytes, "image/png");

  if (result.correctionUsed) {
    await admin.rpc("record_visualization_correction", {
      p_visualization_id: job.visualization_id,
      p_user_id: job.user_id,
    });
  }

  const { error } = await admin.rpc("finalize_outfit_visualization", {
    p_job_id: job.id,
    p_user_id: job.user_id,
    p_bucket: bucket,
    p_storage_path: path,
    p_output_sha256: result.image.sha256,
    p_qa_summary: safeQaSummary(result.assessment, result.correctionUsed),
    p_hotspots: result.hotspots,
    p_request_id: result.image.requestId,
  });
  if (error) throw error;
}

/**
 * Stage transitions and the supersede path, both through RPCs rather than raw
 * table writes, so the visualization row and its job can never disagree about
 * where the work got to.
 */
function stageWriters(admin: AdminClient, job: VisualizationJobRow) {
  const advance = async (status: string) => {
    await admin.rpc("advance_outfit_visualization", {
      p_visualization_id: job.visualization_id,
      p_user_id: job.user_id,
      p_status: status,
    });
  };

  /**
   * Retires the visualization row too, not just the job. Marking only the job
   * left the visualization at 'validating_inputs', which the client treats as
   * in-flight and polls forever with no terminal state and no retry.
   */
  const supersede = async (reason: string) => {
    await admin.rpc("supersede_outfit_visualization", {
      p_job_id: job.id,
      p_user_id: job.user_id,
      p_reason: reason,
    });
  };

  return { advance, supersede };
}

/**
 * Renders one already-claimed (status='running') job through the full
 * pipeline: validating_inputs -> generating -> qa_review -> localizing ->
 * ready. Each stage is written back so the UI's named progress steps describe
 * real work. The caller is responsible for claiming the job first.
 */
export async function processClaimedVisualizationJob(
  admin: AdminClient,
  job: VisualizationJobRow,
): Promise<VisualizationJobOutcome> {
  try {
    const { advance, supersede } = stageWriters(admin, job);

    await advance("validating_inputs");
    const context = await loadJobContext(admin, job);
    if (!context) {
      await supersede("inputs_unavailable");
      return "superseded";
    }

    const provider = resolveVisualizationProvider();
    const garments = await loadGarmentInputs(admin, job.user_id, context.items);
    const attempt = { userId: job.user_id, identity: context.identity, garments };

    const accepted = await generateWithQaGate(
      provider,
      attempt,
      context.visualization.corrective_attempt_count,
      advance,
    );

    await advance("localizing");
    const hotspots = await locateGarmentHotspots(provider, {
      ...attempt,
      image: accepted.image.bytes,
    });

    await storeVisualizationResult(admin, job, { ...accepted, hotspots });
    return "completed";
  } catch (error) {
    await handleVisualizationFailure(admin, job, error);
    return "failed";
  }
}

/**
 * Small claim size: each job is an image generation plus a vision assessment
 * plus a localization call, so total processing time per job is both long and
 * unpredictable and a large batch would strand leases.
 */
const CLAIM_LIMIT = 2;

const LEASE_SECONDS = 600;

/**
 * Claims a small batch of queued/failed visualization jobs and renders each
 * one, stopping before the caller's execution budget runs out rather than
 * running the last job late and blowing the route's maxDuration. Never runs on
 * the request path.
 */
export async function processVisualizationBatch(startedAt: number, budgetMs: number) {
  if (Date.now() - startedAt > budgetMs) {
    return { claimed: 0, completed: 0, failed: 0, superseded: 0, skipped: 0 };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_outfit_visualization_jobs", {
    p_limit: CLAIM_LIMIT,
    p_lease_seconds: LEASE_SECONDS,
    p_locked_by: "visualization-worker",
  });
  if (error) throw error;

  const jobs = (Array.isArray(data) ? data : data ? [data] : []) as VisualizationJobRow[];
  let completed = 0;
  let failed = 0;
  let superseded = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (Date.now() - startedAt > budgetMs) {
      // Leave the rest to their leases: the claim RPC only takes jobs whose
      // lease has expired, so the next invocation picks them back up.
      skipped = jobs.length - completed - failed - superseded;
      break;
    }
    const outcome = await processClaimedVisualizationJob(admin, job);
    if (outcome === "completed") completed += 1;
    else if (outcome === "failed") failed += 1;
    else superseded += 1;
  }

  return { claimed: jobs.length, completed, failed, superseded, skipped };
}

/**
 * Renders a single job already claimed via claim_owned_outfit_visualization_job
 * — the interactive counterpart to processVisualizationBatch, used only when a
 * deployment opts in through VISUALIZATION_INLINE_PROCESSING_ENABLED.
 *
 * Re-selects the row by id scoped to the expected user rather than trusting
 * what the claim RPC returned, mirroring the import and research workers.
 */
export async function processOwnedVisualizationJob(jobId: string, expectedUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("outfit_visualization_jobs")
    .select("id, visualization_id, user_id, attempt_count, max_attempts")
    .eq("id", jobId)
    .eq("user_id", expectedUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Visualization job not found.");

  const outcome = await processClaimedVisualizationJob(admin, data as VisualizationJobRow);
  return { jobId, visualizationId: data.visualization_id as string, outcome };
}
