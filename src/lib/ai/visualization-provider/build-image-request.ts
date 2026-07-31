import { toFile } from "openai";

import type { ImageCapabilityProfile } from "./capabilities.data";
import { VisualizationProviderError } from "./provider-error";
import type { GenerateVisualizationInput } from "./types";

/**
 * Builds the provider payload from the capability profile, so only parameters
 * the configured model actually supports are sent. `input_fidelity` in
 * particular is omitted entirely for profiles whose models apply it
 * automatically and reject it as an unknown parameter.
 *
 * Image 1 is always the identity reference; garments follow in imageNumber
 * order, which is the same order the prompt maps to roles.
 */
export async function buildImageEditRequest(
  input: GenerateVisualizationInput,
  capability: ImageCapabilityProfile,
  model: string,
  prompt: string,
) {
  const garments = [...input.garments].sort(
    (first, second) => first.imageNumber - second.imageNumber,
  );
  if (garments.length + 1 > capability.maxImageInputs) {
    throw new VisualizationProviderError(
      "unsupported_capability",
      "This outfit has more pieces than the configured image model can render at once.",
    );
  }

  const identityFile = await toFile(input.identity, "identity-reference.png", {
    type: "image/png",
  });
  const garmentFiles = await Promise.all(
    garments.map((garment) =>
      toFile(garment.cutout, `garment-${garment.imageNumber}.png`, { type: "image/png" }),
    ),
  );

  return {
    model,
    image: [identityFile, ...garmentFiles],
    prompt,
    size: capability.portraitSize,
    output_format: capability.outputFormat,
    background: capability.background,
    user: input.userId,
    stream: false as const,
    ...(capability.sendInputFidelity ? { input_fidelity: "high" as const } : {}),
  };
}
