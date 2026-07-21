import { toFile } from "openai";
import type { ImagesResponse } from "openai/resources/images";
import { getOpenAIClient } from "@/lib/ai/client";
import {
  buildGarmentExtractionPrompt,
  type GarmentPromptMetadata,
} from "@/lib/ai/prompts/garment-extraction";
import { requireEnvironment } from "@/lib/env/server";
import {
  chooseChromaKey,
  processChromaBackground,
  type CleanupDiagnostics,
} from "@/lib/image/cleanup";

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

function generatedImageBytes(response: ImagesResponse) {
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw new Error("The image model returned no image data.");
  return Buffer.from(encoded, "base64");
}

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

export type ModeledPreviewInput = {
  userId: string;
  identityReference: Buffer;
  garmentCutout: Buffer;
  prompt: string;
};

export async function generateModeledPreview(input: ModeledPreviewInput): Promise<Buffer> {
  const environment = requireEnvironment("OPENAI_IMAGE_MODEL");
  const client = getOpenAIClient();
  const [identityFile, garmentFile] = await Promise.all([
    toFile(input.identityReference, "private-identity-reference.png", { type: "image/png" }),
    toFile(input.garmentCutout, "wardrobe-garment.png", { type: "image/png" }),
  ]);
  const response = await client.images.edit({
    model: environment.OPENAI_IMAGE_MODEL,
    image: [identityFile, garmentFile],
    prompt: input.prompt,
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
