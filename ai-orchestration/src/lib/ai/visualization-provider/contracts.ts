import type { OutfitItemRole } from "@/features/outfits";
import type {
  IdentityReferenceAssessment,
  VisualizationAssessment,
  VisualizationLocalization,
} from "@/lib/visualization";

/**
 * Capability profiles are keyed by *capability*, never by model name: the
 * repository forbids hard-coded model IDs, and a name-keyed table would
 * silently mis-configure the day a deployment points OPENAI_IMAGE_MODEL at a
 * different model. The deployment selects a profile explicitly through
 * OPENAI_IMAGE_CAPABILITY_PROFILE after running a non-production smoke test.
 *
 * `auto_fidelity` matches image models that apply high input fidelity
 * automatically and reject an explicit `input_fidelity` parameter.
 * `explicit_high_fidelity` matches models that require it to be sent.
 */
export const IMAGE_CAPABILITY_PROFILES = ["auto_fidelity", "explicit_high_fidelity"] as const;

export type ImageCapabilityProfileName = (typeof IMAGE_CAPABILITY_PROFILES)[number];

export type ImageCapabilityProfile = {
  /** Recorded in the freshness hash, so a profile change invalidates images. */
  version: string;
  sendInputFidelity: boolean;
  /** Portrait: full-body try-on is never rendered landscape. */
  portraitSize: "1024x1536";
  /** Total images the edit call accepts, identity reference included. */
  maxImageInputs: number;
  outputFormat: "png";
  background: "auto";
};

export const IMAGE_CAPABILITY_PROFILE_TABLE: Record<
  ImageCapabilityProfileName,
  ImageCapabilityProfile
> = {
  auto_fidelity: {
    version: "auto_fidelity@1",
    sendInputFidelity: false,
    portraitSize: "1024x1536",
    maxImageInputs: 10,
    outputFormat: "png",
    background: "auto",
  },
  explicit_high_fidelity: {
    version: "explicit_high_fidelity@1",
    sendInputFidelity: true,
    portraitSize: "1024x1536",
    maxImageInputs: 10,
    outputFormat: "png",
    background: "auto",
  },
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
  readonly name: "openai" | "fake";
  readonly capability: ImageCapabilityProfile;
  readonly modelKey: string;
  generate(input: GenerateVisualizationInput): Promise<GeneratedVisualizationImage>;
  assess(input: AssessVisualizationInput): Promise<VisualizationAssessment>;
  localize(input: LocalizeVisualizationInput): Promise<VisualizationLocalization>;
  assessIdentity(input: AssessIdentityInput): Promise<IdentityReferenceAssessment>;
}
