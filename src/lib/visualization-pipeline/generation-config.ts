import { resolveVisualizationProvider } from "@/lib/ai/visualization-provider";
import { getServerEnvironment } from "@/lib/env/server";
import {
  OUTFIT_VISUALIZATION_PROMPT_VERSION,
  VISUALIZATION_LOCALIZATION_VERSION,
  VISUALIZATION_QA_SCHEMA_VERSION,
} from "@/lib/visualization";

/**
 * Every configuration input that can change the rendered image, gathered in
 * one place so the freshness hash and the persisted row can never disagree
 * about what produced a given result.
 */
export function resolveGenerationConfig() {
  const provider = resolveVisualizationProvider();
  const environment = getServerEnvironment();
  return {
    provider,
    promptVersion: OUTFIT_VISUALIZATION_PROMPT_VERSION,
    providerName: provider.name,
    modelKey: provider.modelKey,
    capabilityVersion: provider.capability.version,
    outputSize: provider.capability.portraitSize,
    outputQuality: environment.OPENAI_IMAGE_QUALITY,
    qaVersion: VISUALIZATION_QA_SCHEMA_VERSION,
    localizationVersion: VISUALIZATION_LOCALIZATION_VERSION,
  };
}

export type GenerationConfig = ReturnType<typeof resolveGenerationConfig>;
