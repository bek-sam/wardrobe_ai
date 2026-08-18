import type { ImagesResponse } from "openai/resources/images";
import type { GarmentPromptMetadata } from "@/lib/ai/prompts";
import type { CleanupDiagnostics } from "@/lib/image/cleanup";
import { toFile } from "openai";
import { getOpenAIClient } from "@/lib/ai/client";
import { buildGarmentExtractionPrompt } from "@/lib/ai/prompts";
import { buildOutfitPreviewPrompt, type OutfitPreviewPromptItem } from "@/lib/ai/prompts";
import { requireEnvironment } from "@/lib/env/server";
import { chooseChromaKey, processChromaBackground } from "@/lib/image/cleanup";

export function generatedImageBytes(response: ImagesResponse) {
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw new Error("The image model returned no image data.");
  return Buffer.from(encoded, "base64");
}

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
  items: OutfitPreviewPromptItem[];
};

export async function extractGarment(input: ExtractGarmentInput): Promise<ExtractGarmentResult> {
  const environment = requireEnvironment("OPENAI_IMAGE_MODEL");
  const client = getOpenAIClient();
  const garmentColors = [input.metadata.primaryColorHex, input.metadata.secondaryColorHex].filter(
    (color): color is string => Boolean(color),
  );
  const chromaKey = chooseChromaKey(garmentColors);
  const basePrompt = buildGarmentExtractionPrompt(input.metadata, chromaKey);
  const prompt = input.regenerationInstruction?.trim()
    ? `${basePrompt}\n\nUser correction: ${input.regenerationInstruction.trim().slice(0, 1_200)}`
    : basePrompt;
  const cropFile = await toFile(input.crop, "garment-crop.png", { type: "image/png" });

  const response = await client.images.edit({
    model: environment.OPENAI_IMAGE_MODEL,
    image: cropFile,
    prompt,
    size: "1024x1024",
    quality: environment.OPENAI_IMAGE_QUALITY,
    output_format: "png",
    background: "opaque",
    input_fidelity: "high",
    user: input.userId,
    stream: false,
  });
  const rawSource = generatedImageBytes(response);
  const cleaned = await processChromaBackground(rawSource, chromaKey, {
    tolerance: input.cleanupTolerance,
  });

  return {
    rawSource,
    cutout: cleaned.bytes,
    chromaKey,
    cleanup: cleaned.diagnostics,
  };
}

export async function generateModeledPreview(input: ModeledPreviewInput): Promise<Buffer> {
  const environment = requireEnvironment("OPENAI_IMAGE_MODEL");
  const client = getOpenAIClient();
  const identityFile = await toFile(input.identityReference, "private-identity-reference.png", {
    type: "image/png",
  });
  const garmentFiles = await Promise.all(
    input.garmentCutouts.map((cutout, index) =>
      toFile(cutout, `wardrobe-garment-${index}.png`, { type: "image/png" }),
    ),
  );
  const response = await client.images.edit({
    model: environment.OPENAI_IMAGE_MODEL,
    image: [identityFile, ...garmentFiles],
    prompt: buildOutfitPreviewPrompt(input.items),
    size: "1536x1024",
    quality: environment.OPENAI_IMAGE_QUALITY,
    output_format: "png",
    background: "auto",
    input_fidelity: "high",
    user: input.userId,
    stream: false,
  });
  return generatedImageBytes(response);
}
