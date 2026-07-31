import type { OutfitItemRole } from "@/features/outfits/types";

import type { VISUALIZATION_SOURCE_KINDS, VISUALIZATION_STATUSES } from "./constants.data";

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
