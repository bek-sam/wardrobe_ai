import type { OutfitItemRole } from "@/features/outfits/types";
import type { OutfitVariantMode } from "@/lib/ai/schemas/outfit-variants";
import type { GarmentHotspot, VisualizationStatus } from "@/lib/visualization";

export type { OutfitVariantMode };

export type StudioVariantItem = {
  itemId: string;
  role: OutfitItemRole;
  sortOrder: number;
  name: string;
  category: string;
  colorNames: string[];
  primaryColorHex: string | null;
  pattern: string | null;
  availabilityStatus: string;
  favorite: boolean;
  wearCount: number;
};

export type StudioVariant = {
  mode: OutfitVariantMode;
  candidateId: string;
  title: string;
  items: StudioVariantItem[];
  reasons: string[];
  warnings: string[];
  stylistNote: string;
  confidence: number;
  styleTags: string[];
  canVisualize: boolean;
};

export type StudioVariantsResponse = {
  variants: StudioVariant[];
  contextSummary: string;
  shortfallReason: string | null;
  generationId: string | null;
};

export type StudioGarmentDetail = {
  itemId: string;
  role: OutfitItemRole;
  sortOrder: number;
  hotspot: GarmentHotspot | null;
  available: boolean;
  item: Record<string, unknown> | null;
  cutoutUrl: string | null;
};

export type StudioVisualization = {
  id: string;
  status: VisualizationStatus;
  progressLabel: string | null;
  inFlight: boolean;
  canRetry: boolean;
  canChangePhoto: boolean;
  staleReason: string | null;
  errorCode: string | null;
  errorSummary: string | null;
  imageUrl: string | null;
  disclaimer: string;
  garments: StudioGarmentDetail[];
};

export type IdentityState = {
  active: { id: string; validation_status: string; consent_version: string | null } | null;
  pending: { id: string; validation_status: string; validation_summary: unknown } | null;
  previewUrl: string | null;
  consentVersion: string;
  consentCurrent: boolean;
  tryOnConfigured: boolean;
};
