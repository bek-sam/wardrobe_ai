import type { OutfitItemRole } from "@/features/outfits";
import type {
  IdentityReferenceAssessment,
  VisualizationAssessment,
  VisualizationLocalization,
} from "@/lib/visualization";

/** Public behavior of the private visualization task, not provider policy. */
export type VisualizationServicePolicy = {
  version: string;
  portraitSize: "1024x1536";
  maxImageInputs: number;
  outputFormat: "png";
};

export const VISUALIZATION_SERVICE_POLICY: VisualizationServicePolicy = {
  version: "visualization-service@v2",
  portraitSize: "1024x1536",
  maxImageInputs: 10,
  outputFormat: "png",
};

export const VISUALIZATION_ERROR_CODES = [
  "configuration_missing",
  "authentication",
  "unsupported_capability",
  "input_validation",
  "moderation_blocked",
  "rate_limited",
  "provider_transient",
  "timeout",
  "invalid_output",
  "qa_rejected",
  "unknown",
] as const;

export type VisualizationErrorCode = (typeof VISUALIZATION_ERROR_CODES)[number];

/** Codes worth another attempt on a backoff; everything else is terminal. */
const RETRYABLE: ReadonlySet<VisualizationErrorCode> = new Set<VisualizationErrorCode>([
  "rate_limited",
  "provider_transient",
  "timeout",
  "invalid_output",
]);

/**
 * A provider failure reduced to a bounded code and a safe summary. The
 * original error object is deliberately dropped: provider errors can echo
 * request bodies, and those carry the private prompt and image bytes.
 */
export class VisualizationProviderError extends Error {
  constructor(
    readonly code: VisualizationErrorCode,
    readonly safeSummary: string,
    readonly requestId: string | null = null,
  ) {
    super(safeSummary);
    this.name = "VisualizationProviderError";
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

export function isRetryableVisualizationError(error: unknown): boolean {
  return error instanceof VisualizationProviderError && error.retryable;
}

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
  readonly name: "ai-orchestration";
  readonly capability: VisualizationServicePolicy;
  readonly modelKey: string;
  generate(input: GenerateVisualizationInput): Promise<GeneratedVisualizationImage>;
  assess(input: AssessVisualizationInput): Promise<VisualizationAssessment>;
  localize(input: LocalizeVisualizationInput): Promise<VisualizationLocalization>;
  assessIdentity(input: AssessIdentityInput): Promise<IdentityReferenceAssessment>;
}
