import { getOpenAIClient } from "@/lib/ai/client";
import { buildOutfitVisualizationPrompt } from "@/lib/ai/prompts/outfit-visualization";

import { buildImageEditRequest } from "../build-image-request";
import type { ImageCapabilityProfile } from "../capabilities.data";
import { normalizeVisualizationProviderError } from "../normalize-error";
import { VisualizationProviderError } from "../provider-error";
import type { GenerateVisualizationInput, GeneratedVisualizationImage } from "../types";
import { validateGeneratedImage } from "../validate-output";

export async function generateWithOpenAI(
  input: GenerateVisualizationInput,
  capability: ImageCapabilityProfile,
  model: string,
): Promise<GeneratedVisualizationImage> {
  const prompt = buildOutfitVisualizationPrompt(input.garments, input.correctionInstructions ?? []);
  const request = await buildImageEditRequest(input, capability, model, prompt);

  try {
    const response = await getOpenAIClient().images.edit(request).withResponse();
    const encoded = response.data.data?.[0]?.b64_json;
    // The one field that lets a "wrong garment" report be correlated with the
    // provider's own logs, so it is captured on success as well as on failure.
    const requestId = response.response.headers.get("x-request-id");
    if (!encoded) {
      throw new VisualizationProviderError(
        "invalid_output",
        "The provider returned no image data.",
        requestId,
      );
    }
    return await validateGeneratedImage(Buffer.from(encoded, "base64"), requestId);
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}
