import { runAiTask } from "@/lib/ai/client";
import type { CleanupDiagnostics } from "@/lib/image/cleanup";

export type GarmentPromptMetadata = {
  name?: string | null;
  category?: string | null;
  primaryColorHex?: string | null;
  secondaryColorHex?: string | null;
  visibleDetails?: readonly string[];
};

export type ExtractGarmentInput = {
  userId: string;
  crop: Buffer;
  metadata: GarmentPromptMetadata;
  regenerationInstruction?: string | null;
  cleanupTolerance?: number;
};

export type ExtractGarmentResult = {
  rawSource: Buffer;
  cutout: Buffer;
  chromaKey: string;
  cleanup: CleanupDiagnostics;
};

export type ModeledPreviewInput = {
  userId: string;
  identityReference: Buffer;
  garmentCutouts: Buffer[];
  prompt: string;
};

export function extractGarment(input: ExtractGarmentInput): Promise<ExtractGarmentResult> {
  return runAiTask("extract-garment", input, 180_000);
}

export function generateModeledPreview(input: ModeledPreviewInput): Promise<Buffer> {
  return runAiTask("modeled-preview", input, 180_000);
}
