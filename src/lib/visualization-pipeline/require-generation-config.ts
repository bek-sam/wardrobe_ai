import { VisualizationProviderError } from "@/lib/ai/visualization-provider";
import { ApiError } from "@/lib/api/response";

import { resolveGenerationConfig, type GenerationConfig } from "./generation-config";

/**
 * Fails closed with a typed 503, matching requireStylistModel and
 * requirePlannerModel, rather than surfacing as an opaque 500 the interface
 * cannot explain and the logs record as unclassified.
 */
export function requireGenerationConfig(): GenerationConfig {
  try {
    return resolveGenerationConfig();
  } catch (error) {
    if (error instanceof VisualizationProviderError && error.code === "configuration_missing") {
      throw new ApiError(503, "visualization_unavailable", error.safeSummary);
    }
    throw error;
  }
}
