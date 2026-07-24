import { toFile } from "openai";

import { getOpenAIClient } from "@/lib/ai/client";
import { requireEnvironment } from "@/lib/env/server";

import { generatedImageBytes } from "./generated-bytes";
import type { ModeledPreviewInput } from "./types";

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
