import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadPrivateObject } from "@/lib/storage/private-images";
import { sha256Hex } from "@/lib/visualization/server";
import type { OutfitItemRole } from "@/features/outfits";
import { ApiError } from "@/lib/api/response";
import type { CreateVisualizationInput } from "@/lib/visualization";
import type { VisualizationSnapshotItem } from "@/lib/visualization";
import { resolveVisualizationProvider } from "@/lib/ai/visualization-provider";
import {
  OUTFIT_VISUALIZATION_PROMPT_VERSION,
  VISUALIZATION_LOCALIZATION_VERSION,
  VISUALIZATION_QA_SCHEMA_VERSION,
} from "@/lib/visualization";
import sharp from "sharp";
import { AI_TRYON_DISCLAIMER } from "@/lib/visualization";
import type { VisualizationRequestResult, VisualizationStatus } from "@/lib/visualization";
import type { ActiveIdentityReference } from "@/lib/identity-reference";
import { computeVisualizationSourceHash } from "@/lib/visualization/server";
import { VisualizationProviderError } from "@/lib/ai/visualization-provider";

export type CutoutReference = {
  itemId: string;
  bucketId: string;
  storagePath: string;
  sha256: string;
};

/**
 * The item's primary cutout plus its content hash, computing and caching the
 * hash on first use. Downloading once to hash is the price of a freshness
 * signal that actually tracks bytes; every later request reads the stored
 * value and makes no storage call at all.
 */
export async function resolveCutoutReference(
  admin: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<CutoutReference | null> {
  const { data, error } = await admin
    .from("wardrobe_item_images")
    .select("id, bucket_id, storage_path, content_sha256")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("kind", "cutout")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Deliberately not swallowed: a schema or permission problem here would
  // otherwise masquerade as "this garment has no cut-out", sending the user to
  // re-import a photo that already exists.
  if (error) throw error;
  if (!data) return null;

  const bucketId = data.bucket_id as string;
  const storagePath = data.storage_path as string;
  const cached = data.content_sha256 as string | null;
  if (cached) return { itemId, bucketId, storagePath, sha256: cached };

  const bytes = await downloadPrivateObject(admin, bucketId, storagePath, userId);
  const sha256 = sha256Hex(bytes);
  await admin
    .from("wardrobe_item_images")
    .update({ content_sha256: sha256 })
    .eq("id", data.id as string)
    .eq("user_id", userId);
  return { itemId, bucketId, storagePath, sha256 };
}

export type SourceSelection = { item_id: string; role: OutfitItemRole; sort_order: number };

const SOURCE_TABLES = {
  candidate: { table: "outfit_candidates", join: "outfit_candidate_items", key: "candidate_id" },
  outfit: { table: "outfits", join: "outfit_items", key: "outfit_id" },
} as const;

async function selectionsFor(
  supabase: SupabaseClient,
  userId: string,
  kind: "candidate" | "outfit",
  sourceId: string,
): Promise<SourceSelection[]> {
  const config = SOURCE_TABLES[kind];
  const { data, error } = await supabase
    .from(config.join)
    .select("item_id, role, sort_order")
    .eq("user_id", userId)
    .eq(config.key, sourceId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) throw new ApiError(404, "not_found", "That look was not found.");
  return data as SourceSelection[];
}

/**
 * Normalizes every supported source into one ordered selection, always scoped
 * to the authenticated viewer's own rows. A plan resolves through its outfit;
 * a composition is the caller's explicit selection, which the creating RPC
 * independently re-verifies against owned, active, available items.
 */
export async function resolveSourceSelections(
  supabase: SupabaseClient,
  userId: string,
  input: CreateVisualizationInput,
): Promise<SourceSelection[]> {
  if (input.sourceKind === "composition") return input.items as SourceSelection[];
  if (input.sourceKind !== "plan") {
    return selectionsFor(supabase, userId, input.sourceKind, input.sourceId as string);
  }

  const { data, error } = await supabase
    .from("outfit_plans")
    .select("outfit_id")
    .eq("id", input.sourceId as string)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.outfit_id) throw new ApiError(404, "not_found", "That plan has no outfit yet.");
  return selectionsFor(supabase, userId, "outfit", data.outfit_id as string);
}

/**
 * Turns an ordered selection into the immutable snapshot the visualization is
 * pinned to. A garment with no approved cutout blocks the whole request with a
 * named, actionable error rather than being silently dropped — omitting a
 * foundation piece would render an outfit the user never asked for.
 */
export async function buildVisualizationSnapshot(
  admin: SupabaseClient,
  userId: string,
  selections: readonly SourceSelection[],
): Promise<VisualizationSnapshotItem[]> {
  const ordered = [...selections].sort((first, second) => first.sort_order - second.sort_order);
  const snapshot: VisualizationSnapshotItem[] = [];

  for (const [index, selection] of ordered.entries()) {
    const cutout = await resolveCutoutReference(admin, userId, selection.item_id);
    if (!cutout) {
      throw new ApiError(
        422,
        "missing_cutout",
        "One of these pieces has no cut-out photo yet, so it cannot be rendered. Re-import it through the photo flow to add one.",
        { itemId: selection.item_id },
      );
    }
    snapshot.push({
      itemId: selection.item_id,
      role: selection.role,
      sortOrder: index,
      cutoutBucketId: cutout.bucketId,
      cutoutStoragePath: cutout.storagePath,
      cutoutSha256: cutout.sha256,
    });
  }

  return snapshot;
}

/**
 * Every configuration input that can change the rendered image, gathered in
 * one place so the freshness hash and the persisted row can never disagree
 * about what produced a given result.
 */
export function resolveGenerationConfig() {
  const provider = resolveVisualizationProvider();
  return {
    provider,
    promptVersion: OUTFIT_VISUALIZATION_PROMPT_VERSION,
    providerName: provider.name,
    modelKey: provider.modelKey,
    capabilityVersion: provider.capability.version,
    outputSize: provider.capability.portraitSize,
    outputQuality: "managed",
    qaVersion: VISUALIZATION_QA_SCHEMA_VERSION,
    localizationVersion: VISUALIZATION_LOCALIZATION_VERSION,
  };
}

export type GenerationConfig = ReturnType<typeof resolveGenerationConfig>;

const FOOTER_HEIGHT = 84;

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ??
      character,
  );
}

/**
 * Burns the AI-preview label into a footer strip on the downloaded file. A
 * caption in the page is not enough: once the PNG leaves the app it must still
 * say what it is, or a style visualization can be mistaken for a photograph.
 */
export async function labelVisualizationDownload(bytes: Buffer): Promise<Buffer> {
  const image = sharp(bytes);
  const { width = 1024, height = 1536 } = await image.metadata();
  const fontSize = Math.max(16, Math.round(width / 46));

  const footer = Buffer.from(
    `<svg width="${width}" height="${FOOTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${FOOTER_HEIGHT}" fill="#f4f0e8"/>
      <text x="${width / 2}" y="${FOOTER_HEIGHT / 2 + fontSize / 3}" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="#393632">
        ${escapeXml(AI_TRYON_DISCLAIMER)}
      </text>
    </svg>`,
  );

  return sharp({
    create: { width, height: height + FOOTER_HEIGHT, channels: 4, background: "#f4f0e8" },
  })
    .composite([
      { input: bytes, top: 0, left: 0 },
      { input: footer, top: height, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

type RawOutcome = {
  outcome: string;
  visualization_id?: string;
  status?: string;
  reset_at?: string | null;
  reason?: string;
  consent_version?: string | null;
};

/**
 * The RPC speaks snake_case, the client contract speaks camelCase. Translating
 * once, here, is what keeps `visualizationId` from silently arriving as
 * `undefined` in the browser while the request itself looked successful.
 */
export function normalizeRequestOutcome(raw: unknown): VisualizationRequestResult {
  const value = (raw ?? {}) as RawOutcome;
  const visualizationId = value.visualization_id ?? "";
  const status = (value.status ?? "queued") as VisualizationStatus;

  switch (value.outcome) {
    case "created":
      return { outcome: "created", visualizationId, status: "queued" };
    case "reused":
      return { outcome: "reused", visualizationId, status };
    case "already_fresh":
      return { outcome: "already_fresh", visualizationId, status: "ready" };
    case "queue_full":
      return { outcome: "queue_full", resetAt: value.reset_at ?? null };
    case "quota_exhausted":
      return { outcome: "quota_exhausted", resetAt: value.reset_at ?? null };
    case "needs_identity":
      return { outcome: "needs_identity" };
    case "needs_consent":
      return { outcome: "needs_consent", consentVersion: value.consent_version ?? "" };
    default:
      return { outcome: "conflict", reason: value.reason ?? "This look could not be rendered." };
  }
}

/** The snapshot plus every configuration input, reduced to one stable hash. */
export function snapshotSourceHash(
  snapshot: readonly VisualizationSnapshotItem[],
  identity: ActiveIdentityReference,
  config: GenerationConfig,
): string {
  return computeVisualizationSourceHash({
    items: snapshot,
    identitySha256: identity.sha256,
    promptVersion: config.promptVersion,
    capabilityVersion: config.capabilityVersion,
    modelKey: config.modelKey,
    outputSize: config.outputSize,
    outputQuality: config.outputQuality,
    qaVersion: config.qaVersion,
    localizationVersion: config.localizationVersion,
  });
}

/** Snapshot rows in the shape the creating RPC expects. */
export function snapshotRpcItems(snapshot: readonly VisualizationSnapshotItem[]) {
  return snapshot.map((item) => ({
    item_id: item.itemId,
    role: item.role,
    sort_order: item.sortOrder,
    cutout_bucket_id: item.cutoutBucketId,
    cutout_storage_path: item.cutoutStoragePath,
    cutout_sha256: item.cutoutSha256,
  }));
}

export type RequestVisualizationInput = {
  sourceKind: string;
  sourceId: string | null;
  snapshot: readonly VisualizationSnapshotItem[];
  identity: ActiveIdentityReference;
  config: GenerationConfig;
};

/**
 * Computes the freshness hash and hands the snapshot to the transactional RPC,
 * which owns ownership re-verification, dedupe, rate limiting, the queue cap,
 * and the paid quota. Nothing here decides whether to spend money.
 */
export async function requestVisualization(
  supabase: SupabaseClient,
  input: RequestVisualizationInput,
): Promise<VisualizationRequestResult> {
  const { config } = input;

  const { data, error } = await supabase.rpc("request_outfit_visualization", {
    p_source_kind: input.sourceKind,
    p_source_id: input.sourceId,
    p_source_hash: snapshotSourceHash(input.snapshot, input.identity, config),
    p_items: snapshotRpcItems(input.snapshot),
    p_prompt_version: config.promptVersion,
    p_provider: config.providerName,
    p_model_key: config.modelKey,
    p_capability_version: config.capabilityVersion,
    p_output_size: config.outputSize,
    p_output_quality: config.outputQuality,
    p_qa_version: config.qaVersion,
    p_localization_version: config.localizationVersion,
  });
  if (error) throw error;
  return normalizeRequestOutcome(data);
}

/**
 * Fails closed with a typed 503, matching requireStylistModel and
 * requirePlannerModel, rather than surfacing as an opaque 500 the interface
 * cannot explain and the logs record as unclassified.
 */
export function requireGenerationConfig(): GenerationConfig {
  try {
    return resolveGenerationConfig();
  } catch (error) {
    if (error instanceof VisualizationProviderError && error.code === "configuration_missing") {
      throw new ApiError(503, "visualization_unavailable", error.safeSummary);
    }
    throw error;
  }
}
