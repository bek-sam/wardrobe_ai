import { toFile } from "openai";

import { getOpenAIClient } from "@/lib/ai/client";
import { buildGarmentExtractionPrompt } from "@/lib/ai/prompts/garment-extraction";
import { requireEnvironment } from "@/lib/env/server";
import { chooseChromaKey, processChromaBackground } from "@/lib/image/cleanup";

import { generatedImageBytes } from "./generated-bytes";
import type { ExtractGarmentInput, ExtractGarmentResult } from "./types";

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
