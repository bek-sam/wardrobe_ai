import type { OutfitItemRole } from "@/features/outfits";
import { z } from "zod";
import { OUTFIT_ITEM_ROLES } from "@/features/outfits";

/**
 * Every version below is an input to the visualization freshness hash, so
 * bumping any one of them correctly invalidates existing visualizations
 * instead of serving an image produced by older behaviour.
 */
export const OUTFIT_VISUALIZATION_PROMPT_VERSION = "outfit-visualization@v2";

export const VISUALIZATION_QA_SCHEMA_VERSION = "visualization-qa@v1";

export const VISUALIZATION_LOCALIZATION_VERSION = "garment-hotspots@v1";

/** Versioned consent statement specific to AI try-on. */
export const TRYON_CONSENT_VERSION = "tryon@2026-07";

/** Product label that must accompany every generated try-on image. */
export const AI_TRYON_DISCLAIMER =
  "AI Try-On Preview — style visualization, not size or fit prediction.";

export const VISUALIZATION_STATUSES = [
  "needs_identity",
  "needs_consent",
  "queued",
  "validating_inputs",
  "generating",
  "qa_review",
  "localizing",
  "ready",
  "stale",
  "failed_retryable",
  "failed_terminal",
  "blocked",
  "superseded",
] as const;

/**
 * `needs_identity` and `needs_consent` are pre-conditions resolved at the API
 * boundary, never persisted, so the column constraint is the smaller set.
 */
export const VISUALIZATION_ROW_STATUSES = VISUALIZATION_STATUSES.filter(
  (status) => status !== "needs_identity" && status !== "needs_consent",
);

export const VISUALIZATION_SOURCE_KINDS = ["candidate", "outfit", "plan", "composition"] as const;

/**
 * Paint order for overlapping hotspots. Footwear sits low and isolated;
 * accessories sit above outerwear so a scarf stays selectable over a coat.
 */
export const VISUALIZATION_ROLE_Z_INDEX: Record<OutfitItemRole, number> = {
  shoes: 1,
  bottom: 2,
  dress: 3,
  top: 4,
  layer: 5,
  accessory: 6,
};

/** Client polling backoff: 1.5s, then 3s, then 5s, capped at 5s. */
export const TRYON_POLL_INTERVALS_MS = [1_500, 3_000, 5_000] as const;

export type VisualizationStatus = (typeof VISUALIZATION_STATUSES)[number];

export type VisualizationSourceKind = (typeof VISUALIZATION_SOURCE_KINDS)[number];

/** One ordered garment in an immutable visualization snapshot. */
export type VisualizationSnapshotItem = {
  itemId: string;
  role: OutfitItemRole;
  sortOrder: number;
  cutoutBucketId: string;
  cutoutStoragePath: string;
  cutoutSha256: string;
};

export type VisualizationFreshnessInput = {
  items: readonly Pick<
    VisualizationSnapshotItem,
    "itemId" | "role" | "sortOrder" | "cutoutSha256"
  >[];
  identitySha256: string;
  promptVersion: string;
  capabilityVersion: string;
  modelKey: string;
  outputSize: string;
  outputQuality: string;
  qaVersion: string;
  localizationVersion: string;
};

export type NormalizedRect = { x: number; y: number; width: number; height: number };

export type NormalizedPoint = { x: number; y: number };

export type PixelRect = { left: number; top: number; width: number; height: number };

export type Size = { width: number; height: number };

export type HotspotSource = "model" | "fallback" | "user_corrected";

export type GarmentHotspot =
  | {
      version: 1;
      itemId: string;
      role: OutfitItemRole;
      shape: "rect";
      bounds: NormalizedRect;
      confidence: number;
      source: HotspotSource;
      zIndex: number;
    }
  | {
      version: 2;
      itemId: string;
      role: OutfitItemRole;
      shape: "polygon";
      points: NormalizedPoint[];
      confidence: number;
      source: HotspotSource;
      zIndex: number;
    };

/**
 * Discriminated enqueue result. `already_fresh`, `queue_full`, and `conflict`
 * stay distinguishable so the UI can never mislabel a full queue as a
 * ready image.
 */
export type VisualizationRequestResult =
  | { outcome: "created"; visualizationId: string; status: "queued" }
  | { outcome: "reused"; visualizationId: string; status: VisualizationStatus }
  | { outcome: "already_fresh"; visualizationId: string; status: "ready" }
  | { outcome: "queue_full"; resetAt: string | null }
  | { outcome: "quota_exhausted"; resetAt: string | null }
  | { outcome: "conflict"; reason: string }
  | { outcome: "needs_identity" }
  | { outcome: "needs_consent"; consentVersion: string };

/**
 * Deterministic approximate body zones for a portrait, full-body, head-through
 * -shoes framing. Used only when localization is missing or below threshold.
 * These are labelled `source: "fallback"` and are never presented as precise
 * segmentation — the garment chips remain the accurate way to select an item.
 */
export const FALLBACK_BODY_ZONES: Record<OutfitItemRole, NormalizedRect> = {
  top: { x: 0.28, y: 0.2, width: 0.44, height: 0.24 },
  bottom: { x: 0.3, y: 0.44, width: 0.4, height: 0.35 },
  dress: { x: 0.27, y: 0.2, width: 0.46, height: 0.5 },
  layer: { x: 0.22, y: 0.18, width: 0.56, height: 0.35 },
  shoes: { x: 0.31, y: 0.85, width: 0.38, height: 0.12 },
  accessory: { x: 0.38, y: 0.12, width: 0.24, height: 0.12 },
};

/**
 * Minimum and maximum plausible normalized area per role. A "top" covering
 * 90% of the frame or 0.1% of it is a localization failure, not a garment.
 */
export const HOTSPOT_AREA_BOUNDS: Record<OutfitItemRole, { min: number; max: number }> = {
  top: { min: 0.01, max: 0.45 },
  bottom: { min: 0.01, max: 0.5 },
  dress: { min: 0.02, max: 0.65 },
  layer: { min: 0.01, max: 0.65 },
  shoes: { min: 0.001, max: 0.2 },
  accessory: { min: 0.0005, max: 0.25 },
};

/** Axis-aligned bounds for either hotspot shape, so callers stay shape-agnostic. */
export function hotspotBounds(hotspot: GarmentHotspot): NormalizedRect {
  if (hotspot.version === 1) return hotspot.bounds;
  const xs = hotspot.points.map((point) => point.x);
  const ys = hotspot.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function hotspotArea(hotspot: GarmentHotspot): number {
  const bounds = hotspotBounds(hotspot);
  return Math.max(0, bounds.width) * Math.max(0, bounds.height);
}

function pointInPolygon(point: NormalizedPoint, points: readonly NormalizedPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index];
    const last = points[previous];
    if (!current || !last) continue;
    const straddles = current.y > point.y !== last.y > point.y;
    if (!straddles) continue;
    const crossingX =
      ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) + current.x;
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

export function hotspotContains(hotspot: GarmentHotspot, point: NormalizedPoint): boolean {
  if (hotspot.version === 2) return pointInPolygon(point, hotspot.points);
  const { x, y, width, height } = hotspot.bounds;
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

/** Below this the model's own region is not trustworthy enough to show. */
export const HOTSPOT_MIN_CONFIDENCE = 0.4;

function withinRoleAreaBounds(hotspot: GarmentHotspot): boolean {
  const bounds = HOTSPOT_AREA_BOUNDS[hotspot.role];
  const area = hotspotArea(hotspot);
  return area >= bounds.min && area <= bounds.max;
}

export function isUsableHotspot(hotspot: GarmentHotspot): boolean {
  return hotspot.confidence >= HOTSPOT_MIN_CONFIDENCE && withinRoleAreaBounds(hotspot);
}

export function fallbackHotspot(
  item: Pick<VisualizationSnapshotItem, "itemId" | "role">,
): GarmentHotspot {
  return {
    version: 1,
    itemId: item.itemId,
    role: item.role,
    shape: "rect",
    bounds: FALLBACK_BODY_ZONES[item.role],
    confidence: 0,
    source: "fallback",
    zIndex: VISUALIZATION_ROLE_Z_INDEX[item.role],
  };
}

/**
 * One hotspot per snapshot item, always. A model region that is missing,
 * low-confidence, or an implausible size for its role degrades to the
 * deterministic body zone rather than dropping the garment out of the image
 * entirely — the chip list stays complete either way.
 */
export function buildSnapshotHotspots(
  items: readonly Pick<VisualizationSnapshotItem, "itemId" | "role">[],
  located: readonly GarmentHotspot[],
): GarmentHotspot[] {
  const usableByItemId = new Map(
    located.filter(isUsableHotspot).map((hotspot) => [hotspot.itemId, hotspot]),
  );
  return items.map((item) => usableByItemId.get(item.itemId) ?? fallbackHotspot(item));
}

/**
 * Where an `object-fit: contain` image actually paints inside its container,
 * in CSS pixels relative to the container's top-left. Everything here is CSS
 * pixels: device-pixel-ratio never enters the calculation, so a retina screen
 * cannot double the offsets.
 */
export function containedImageRect(natural: Size, container: Size): PixelRect {
  if (
    !Number.isFinite(natural.width) ||
    !Number.isFinite(natural.height) ||
    natural.width <= 0 ||
    natural.height <= 0 ||
    container.width <= 0 ||
    container.height <= 0
  ) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const scale = Math.min(container.width / natural.width, container.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
}

/** Projects a 0..1 rect on the natural image onto the painted image area. */
export function projectNormalizedRect(
  bounds: NormalizedRect,
  natural: Size,
  container: Size,
): PixelRect {
  const painted = containedImageRect(natural, container);
  return {
    left: painted.left + bounds.x * painted.width,
    top: painted.top + bounds.y * painted.height,
    width: bounds.width * painted.width,
    height: bounds.height * painted.height,
  };
}

/**
 * Inverse mapping for pointer events. Returns null for a point in the
 * letterbox bars, which belong to the container and not to the image.
 */
export function pointToNormalized(
  point: NormalizedPoint,
  natural: Size,
  container: Size,
): NormalizedPoint | null {
  const painted = containedImageRect(natural, container);
  if (painted.width <= 0 || painted.height <= 0) return null;
  const x = (point.x - painted.left) / painted.width;
  const y = (point.y - painted.top) / painted.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

const normalizedUnit = z.number().min(0).max(1);

const role = z.enum(OUTFIT_ITEM_ROLES);

export const normalizedRectSchema = z
  .object({
    x: normalizedUnit,
    y: normalizedUnit,
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .strict()
  .refine((value) => value.x + value.width <= 1.0001, "The region extends past the right edge.")
  .refine((value) => value.y + value.height <= 1.0001, "The region extends past the bottom edge.");

export const normalizedPointSchema = z.object({ x: normalizedUnit, y: normalizedUnit }).strict();

export const hotspotSourceSchema = z.enum(["model", "fallback", "user_corrected"]);

export const garmentHotspotSchema = z.discriminatedUnion("version", [
  z
    .object({
      version: z.literal(1),
      itemId: z.string().uuid(),
      role,
      shape: z.literal("rect"),
      bounds: normalizedRectSchema,
      confidence: normalizedUnit,
      source: hotspotSourceSchema,
      zIndex: z.number().int().min(0).max(20),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      itemId: z.string().uuid(),
      role,
      shape: z.literal("polygon"),
      points: z.array(normalizedPointSchema).min(3).max(64),
      confidence: normalizedUnit,
      source: hotspotSourceSchema,
      zIndex: z.number().int().min(0).max(20),
    })
    .strict(),
]);

export const visualizationStatusSchema = z.enum(VISUALIZATION_STATUSES);

export const visualizationSourceKindSchema = z.enum(VISUALIZATION_SOURCE_KINDS);

const verdict = z.enum(["pass", "uncertain", "fail"]);

/**
 * Structured quality gate. Deliberately carries no body-shape, weight, age,
 * ethnicity, attractiveness, or health field: the assessment may only report
 * whether the *rendered garments and framing* are faithful.
 */
export const visualizationAssessmentSchema = z
  .object({
    identity: z.object({ recognizableMatch: verdict, faceVisible: z.boolean() }).strict(),
    framing: z
      .object({
        singlePerson: z.boolean(),
        fullBodyVisible: z.boolean(),
        headVisible: z.boolean(),
        shoesVisible: z.boolean(),
      })
      .strict(),
    anatomy: z
      .object({ verdict, issues: z.array(z.string().trim().min(1).max(160)).max(6) })
      .strict(),
    garments: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            role,
            present: z.boolean(),
            colorFidelity: verdict,
            patternFidelity: verdict,
            silhouetteFidelity: verdict,
            constructionFidelity: verdict,
            closureFidelity: verdict,
            distinctiveDetailFidelity: verdict,
          })
          .strict(),
      )
      .max(8),
    extraGarments: z.array(z.string().trim().min(1).max(80)).max(8),
    verdict: z.enum(["pass", "correctable", "fail"]),
    correctionInstructions: z.array(z.string().trim().min(1).max(240)).max(6),
    safeSummary: z.string().trim().min(1).max(400),
  })
  .strict();

/** Localization runs as its own bounded call after QA accepts the image. */
export const visualizationLocalizationSchema = z
  .object({
    regions: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            role,
            bounds: normalizedRectSchema,
            confidence: normalizedUnit,
          })
          .strict(),
      )
      .max(8),
  })
  .strict();

/**
 * Identity-photo suitability. Reports only what makes a photo usable as a
 * rendering reference — never a body-shape, weight, age, ethnicity, health, or
 * attractiveness judgement, which the product's non-goals forbid outright.
 */
export const identityReferenceAssessmentSchema = z
  .object({
    personCount: z.number().int().min(0).max(20),
    fullBody: z.enum(["yes", "partial", "no"]),
    faceVisible: z.boolean(),
    occlusion: z.enum(["low", "medium", "high"]),
    lighting: z.enum(["good", "usable", "poor"]),
    framing: z.enum(["good", "usable", "poor"]),
    verdict: z.enum(["pass", "warn", "fail"]),
    userMessage: z.string().trim().min(1).max(300),
  })
  .strict();

export const activateIdentityReferenceSchema = z
  .object({
    referenceId: z.string().uuid(),
    /** Explicit action, never a passive link: the box must actually be ticked. */
    consentAccepted: z.literal(true),
  })
  .strict();

export const confirmIdentityUploadSchema = z
  .object({ storagePath: z.string().trim().min(1).max(500) })
  .strict();

export const visualizationFeedbackReasons = [
  "looks_like_me",
  "does_not_look_like_me",
  "wrong_garment",
  "missing_garment",
  "bad_anatomy",
  "styling_not_for_me",
  "other",
] as const;

export const visualizationFeedbackSchema = z
  .object({
    reason: z.enum(visualizationFeedbackReasons),
    comment: z.string().trim().min(1).max(600).nullable().default(null),
  })
  .strict();

export const createVisualizationSchema = z
  .object({
    sourceKind: visualizationSourceKindSchema,
    sourceId: z.string().uuid().nullable().default(null),
    /** Ordered exact item selection, used by `composition` snapshots only. */
    items: z
      .array(
        z
          .object({ item_id: z.string().uuid(), role, sort_order: z.number().int().min(0).max(7) })
          .strict(),
      )
      .min(1)
      .max(6)
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.sourceKind === "composition" ? Boolean(value.items) : Boolean(value.sourceId),
    "A composition requires items; every other source requires a sourceId.",
  );

export type IdentityReferenceAssessment = z.output<typeof identityReferenceAssessmentSchema>;

export type VisualizationAssessment = z.output<typeof visualizationAssessmentSchema>;

export type VisualizationLocalization = z.output<typeof visualizationLocalizationSchema>;

export type VisualizationFeedbackInput = z.output<typeof visualizationFeedbackSchema>;

export type CreateVisualizationInput = z.output<typeof createVisualizationSchema>;

export const QA_FOUNDATION_ROLES: readonly OutfitItemRole[] = ["top", "bottom", "dress"];

/**
 * Accessories may render loosely without failing the gate; a foundation
 * garment may not. An invented accessory is still caught separately through
 * `extraGarments`, so loose thresholds here never allow a made-up item.
 */
const PRIMARY_FIDELITY_KEYS = [
  "colorFidelity",
  "patternFidelity",
  "silhouetteFidelity",
  "constructionFidelity",
  "closureFidelity",
] as const;

export function garmentQaFailures(assessment: VisualizationAssessment): string[] {
  const reasons: string[] = [];
  for (const garment of assessment.garments) {
    if (!garment.present) {
      reasons.push(`The ${garment.role} is missing from the image.`);
      continue;
    }
    if (!QA_FOUNDATION_ROLES.includes(garment.role)) continue;
    if (PRIMARY_FIDELITY_KEYS.some((key) => garment[key] === "fail")) {
      reasons.push(`The ${garment.role} was not rendered faithfully.`);
    }
  }
  return reasons;
}

export type QaGateResult =
  | { verdict: "pass"; reasons: [] }
  | { verdict: "correctable"; reasons: string[] }
  | { verdict: "fail"; reasons: string[] };

/**
 * The deterministic gate applied *after* the model's own assessment: the model
 * proposes, this decides. No generated image reaches `ready` without passing
 * here, so a wrong-identity, multi-person, or missing-foundation render can
 * never be served as a normal result.
 */
export function evaluateQaGate(assessment: VisualizationAssessment): QaGateResult {
  const terminal: string[] = [];
  if (assessment.identity.recognizableMatch === "fail") {
    terminal.push("The rendered person does not match your reference photo.");
  }
  if (!assessment.framing.singlePerson) terminal.push("The image contains more than one person.");
  if (assessment.anatomy.verdict === "fail") terminal.push("The rendered pose is not usable.");

  const correctable = garmentQaFailures(assessment);
  if (!assessment.framing.fullBodyVisible || !assessment.framing.headVisible) {
    correctable.push("The framing cut off part of the body.");
  }
  if (assessment.extraGarments.length > 0) {
    correctable.push("The image added a garment that is not in this outfit.");
  }

  if (terminal.length > 0) return { verdict: "fail", reasons: [...terminal, ...correctable] };
  if (correctable.length > 0) return { verdict: "correctable", reasons: correctable };
  if (assessment.verdict === "fail") return { verdict: "fail", reasons: [assessment.safeSummary] };
  if (assessment.verdict === "correctable") {
    return { verdict: "correctable", reasons: [assessment.safeSummary] };
  }
  return { verdict: "pass", reasons: [] };
}

/**
 * A region must be this much smaller than the next candidate before being
 * treated as "materially more specific"; otherwise two comparably sized
 * overlapping layers are genuinely ambiguous and the user picks.
 */
const SPECIFICITY_RATIO = 0.7;

export type HotspotHit =
  | { kind: "none" }
  | { kind: "single"; hotspot: GarmentHotspot }
  | { kind: "ambiguous"; hotspots: GarmentHotspot[] };

/**
 * Resolves a pointer hit over possibly overlapping garment regions:
 * highest zIndex first, then a materially smaller region wins as the more
 * specific target. Two plausible layers of similar size stay ambiguous so the
 * caller can show a "Which layer?" chooser rather than guessing.
 */
export function resolveHotspotHit(
  hotspots: readonly GarmentHotspot[],
  point: NormalizedPoint,
): HotspotHit {
  const containing = hotspots.filter((hotspot) => hotspotContains(hotspot, point));
  if (containing.length === 0) return { kind: "none" };
  if (containing.length === 1) return { kind: "single", hotspot: containing[0] as GarmentHotspot };

  const ranked = [...containing].sort(
    (first, second) => second.zIndex - first.zIndex || hotspotArea(first) - hotspotArea(second),
  );
  const [top, next] = ranked as [GarmentHotspot, GarmentHotspot];
  if (top.zIndex > next.zIndex) return { kind: "single", hotspot: top };
  if (hotspotArea(top) <= hotspotArea(next) * SPECIFICITY_RATIO) {
    return { kind: "single", hotspot: top };
  }
  return { kind: "ambiguous", hotspots: ranked };
}

/**
 * Named progress steps, not a fake percentage: the backend genuinely moves
 * through these stages, so each label is truthful about where the work is.
 */
const PROGRESS_LABELS: Partial<Record<VisualizationStatus, string>> = {
  queued: "Waiting to start",
  validating_inputs: "Preparing your exact pieces",
  generating: "Creating the try-on",
  qa_review: "Checking garment and identity fidelity",
  localizing: "Mapping interactive garment details",
};

const TERMINAL: ReadonlySet<VisualizationStatus> = new Set<VisualizationStatus>([
  "ready",
  "stale",
  "failed_retryable",
  "failed_terminal",
  "blocked",
  "superseded",
  "needs_identity",
  "needs_consent",
]);

export function visualizationProgressLabel(status: VisualizationStatus): string | null {
  return PROGRESS_LABELS[status] ?? null;
}

/** True while the pipeline is still working and the client should keep polling. */
export function isVisualizationInFlight(status: VisualizationStatus): boolean {
  return !TERMINAL.has(status);
}

export function isVisualizationRetryable(status: VisualizationStatus): boolean {
  return status === "failed_retryable" || status === "stale" || status === "superseded";
}

/** Only a ready or stale visualization has bytes worth signing a URL for. */
export function hasVisualizationImage(status: VisualizationStatus): boolean {
  return status === "ready" || status === "stale";
}
