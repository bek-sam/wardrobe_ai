import type { GarmentPromptMetadata } from "@/lib/ai/prompts/garment-extraction";
import type { CleanupDiagnostics } from "@/lib/image/cleanup";

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
  // 1-6 garment cutouts, one per outfit-defining role. There are no existing
  // callers of this function today, so the signature is widened directly
  // from a single garmentCutout rather than adding a parallel function --
  // client.images.edit()'s image param already accepts an array, as
  // extractGarment's sibling call proves.
  garmentCutouts: Buffer[];
  prompt: string;
};
