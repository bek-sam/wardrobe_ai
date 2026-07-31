import { FALLBACK_BODY_ZONES, type VisualizationLocalization } from "@/lib/visualization";

import type { ImageCapabilityProfile } from "../capabilities.data";
import type { OutfitVisualizationProvider } from "../types";
import { buildFakeAssessment } from "./build-assessment";
import { renderFakeVisualization } from "./render-image";
import { applyScriptedFailure, parseFakeOutcome, type FakeOutcome } from "./scripted-outcome";

/**
 * Deterministic, network-free provider for development and automated tests.
 * Produces a real decodable portrait PNG and typed QA/localization results so
 * every pipeline state can be exercised without an OpenAI key or a paid call.
 */
export function createFakeVisualizationProvider(
  capability: ImageCapabilityProfile,
  outcomeSetting: string | undefined,
): OutfitVisualizationProvider {
  const outcome: FakeOutcome = parseFakeOutcome(outcomeSetting);
  const attempts = new Map<string, number>();

  return {
    name: "fake",
    capability,
    modelKey: `fake-visualization-${outcome}`,
    async generate(input) {
      applyScriptedFailure(outcome, attempts);
      return renderFakeVisualization(input);
    },
    async assess(input) {
      return buildFakeAssessment(input.garments, outcome);
    },
    async assessIdentity() {
      return {
        personCount: 1,
        fullBody: "yes" as const,
        faceVisible: true,
        occlusion: "low" as const,
        lighting: "good" as const,
        framing: "good" as const,
        verdict: "pass" as const,
        userMessage: "This photo works well as a reference.",
      };
    },
    async localize(input): Promise<VisualizationLocalization> {
      return {
        regions: input.garments.map((garment) => ({
          itemId: garment.itemId,
          role: garment.role,
          bounds: FALLBACK_BODY_ZONES[garment.role],
          confidence: 0.9,
        })),
      };
    },
  };
}
