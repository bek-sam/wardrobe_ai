import type { ImageCapabilityProfile } from "../capabilities.data";
import type { OutfitVisualizationProvider } from "../types";
import { assessIdentityWithOpenAI } from "./assess-identity";
import { assessWithOpenAI } from "./assess";
import { generateWithOpenAI } from "./generate";
import { localizeWithOpenAI } from "./localize";

export function createOpenAIVisualizationProvider(
  capability: ImageCapabilityProfile,
  modelKey: string,
): OutfitVisualizationProvider {
  return {
    name: "openai",
    capability,
    modelKey,
    generate: (input) => generateWithOpenAI(input, capability, modelKey),
    assess: (input) => assessWithOpenAI(input),
    localize: (input) => localizeWithOpenAI(input),
    assessIdentity: (input) => assessIdentityWithOpenAI(input),
  };
}
