import { AiServiceError, runAiTask } from "@/lib/ai/client";

import {
  VISUALIZATION_SERVICE_POLICY,
  type AssessIdentityInput,
  type AssessVisualizationInput,
  type GenerateVisualizationInput,
  type GeneratedVisualizationImage,
  type LocalizeVisualizationInput,
  type OutfitVisualizationProvider,
  VisualizationProviderError,
} from "./contracts";
import type { VisualizationAssessment, VisualizationLocalization } from "@/lib/visualization";

/** Provider-neutral private HTTP adapter; OpenAI keys and SDK stay in AI Orchestration. */
export function resolveVisualizationProvider(): OutfitVisualizationProvider {
  if (!isVisualizationConfigured()) {
    throw new Error("AI try-on is not configured on this deployment.");
  }
  return {
    name: "ai-orchestration",
    capability: VISUALIZATION_SERVICE_POLICY,
    modelKey: "ai-orchestration@v1",
    generate: (input: GenerateVisualizationInput) =>
      runAiTask<GeneratedVisualizationImage>("visualization-generate", input, 240_000),
    assess: (input: AssessVisualizationInput) =>
      runAiTask<VisualizationAssessment>("visualization-assess", input, 120_000),
    localize: (input: LocalizeVisualizationInput) =>
      runAiTask<VisualizationLocalization>("visualization-localize", input, 120_000),
    assessIdentity: (input: AssessIdentityInput) =>
      runAiTask<Awaited<ReturnType<OutfitVisualizationProvider["assessIdentity"]>>>(
        "identity-assess",
        input,
        120_000,
      ),
  };
}

export function isVisualizationConfigured(): boolean {
  return Boolean(process.env.AI_ORCHESTRATION_URL && process.env.AI_SERVICE_TOKEN);
}

export { VisualizationProviderError };

export function normalizeVisualizationProviderError(error: unknown): VisualizationProviderError {
  if (error instanceof VisualizationProviderError) return error;
  if (error instanceof AiServiceError) {
    const code =
      error.status === 429
        ? "rate_limited"
        : error.status === 408
          ? "timeout"
          : "provider_transient";
    return new VisualizationProviderError(
      code,
      "The visualization service could not complete the request.",
    );
  }
  return new VisualizationProviderError(
    "unknown",
    "The visualization service could not complete the request.",
  );
}

export type {
  AssessIdentityInput,
  AssessVisualizationInput,
  GenerateVisualizationInput,
  GeneratedVisualizationImage,
  LocalizeVisualizationInput,
  OutfitVisualizationProvider,
  VisualizationErrorCode,
  VisualizationGarmentInput,
  VisualizationServicePolicy,
} from "./contracts";
