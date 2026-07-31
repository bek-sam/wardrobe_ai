import type { OutfitItemRole } from "@/features/outfits/types";
import type {
  IdentityReferenceAssessment,
  VisualizationAssessment,
  VisualizationLocalization,
} from "@/lib/visualization";

import type { ImageCapabilityProfile } from "./capabilities.data";

/** A garment the provider must render, with its explicit image slot number. */
export type VisualizationGarmentInput = {
  /** 1-based position in the provider payload. Image 1 is always identity. */
  imageNumber: number;
  itemId: string;
  role: OutfitItemRole;
  name: string;
  colorNames: readonly string[];
  pattern: string | null;
  fit: string | null;
  silhouette: string | null;
  materials: readonly string[];
  cutout: Buffer;
};

export type GenerateVisualizationInput = {
  userId: string;
  identity: Buffer;
  garments: readonly VisualizationGarmentInput[];
  /** Specific structured failures from a rejected first attempt, if any. */
  correctionInstructions?: readonly string[];
};

export type GeneratedVisualizationImage = {
  bytes: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  sha256: string;
  requestId: string | null;
};

export type AssessVisualizationInput = {
  userId: string;
  image: Buffer;
  identity: Buffer;
  garments: readonly VisualizationGarmentInput[];
};

export type LocalizeVisualizationInput = AssessVisualizationInput;

export type AssessIdentityInput = { userId: string; image: Buffer };

export interface OutfitVisualizationProvider {
  readonly name: "openai" | "fake";
  readonly capability: ImageCapabilityProfile;
  readonly modelKey: string;
  generate(input: GenerateVisualizationInput): Promise<GeneratedVisualizationImage>;
  assess(input: AssessVisualizationInput): Promise<VisualizationAssessment>;
  localize(input: LocalizeVisualizationInput): Promise<VisualizationLocalization>;
  assessIdentity(input: AssessIdentityInput): Promise<IdentityReferenceAssessment>;
}
