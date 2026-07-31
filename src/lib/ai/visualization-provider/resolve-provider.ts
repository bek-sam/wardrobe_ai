import { getServerEnvironment, requireEnvironment } from "@/lib/env/server";

import { IMAGE_CAPABILITY_PROFILE_TABLE } from "./capabilities.data";
import { createFakeVisualizationProvider } from "./fake";
import { createOpenAIVisualizationProvider } from "./openai";
import { VisualizationProviderError } from "./provider-error";
import type { OutfitVisualizationProvider } from "./types";

/**
 * Fails closed: with no image model or QA model configured, the try-on
 * pipeline reports a configuration error rather than silently degrading to the
 * fake provider. The fake is only ever returned when a deployment sets
 * OUTFIT_VISUALIZATION_PROVIDER="fake" explicitly.
 */
export function resolveVisualizationProvider(): OutfitVisualizationProvider {
  const environment = getServerEnvironment();
  const capability = IMAGE_CAPABILITY_PROFILE_TABLE[environment.OPENAI_IMAGE_CAPABILITY_PROFILE];

  if (environment.OUTFIT_VISUALIZATION_PROVIDER === "fake") {
    return createFakeVisualizationProvider(
      capability,
      environment.OUTFIT_VISUALIZATION_FAKE_OUTCOME,
    );
  }

  if (!environment.OPENAI_IMAGE_MODEL || !environment.OPENAI_VISUALIZATION_QA_MODEL) {
    throw new VisualizationProviderError(
      "configuration_missing",
      "AI try-on is not configured on this deployment.",
    );
  }
  const configured = requireEnvironment("OPENAI_IMAGE_MODEL", "OPENAI_VISUALIZATION_QA_MODEL");
  return createOpenAIVisualizationProvider(capability, configured.OPENAI_IMAGE_MODEL);
}

/** True when a try-on can be enqueued at all on this deployment. */
export function isVisualizationConfigured(): boolean {
  const environment = getServerEnvironment();
  if (environment.OUTFIT_VISUALIZATION_PROVIDER === "fake") return true;
  return Boolean(
    environment.OPENAI_API_KEY &&
    environment.OPENAI_IMAGE_MODEL &&
    environment.OPENAI_VISUALIZATION_QA_MODEL,
  );
}
