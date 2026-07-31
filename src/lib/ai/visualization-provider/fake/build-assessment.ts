import type { VisualizationAssessment } from "@/lib/visualization";

import type { VisualizationGarmentInput } from "../types";
import type { FakeOutcome } from "./scripted-outcome";

export function buildFakeAssessment(
  garments: readonly VisualizationGarmentInput[],
  outcome: FakeOutcome,
): VisualizationAssessment {
  const failing = outcome === "qa_fail";
  return {
    identity: { recognizableMatch: failing ? "fail" : "pass", faceVisible: !failing },
    framing: {
      singlePerson: true,
      fullBodyVisible: true,
      headVisible: true,
      shoesVisible: garments.some((garment) => garment.role === "shoes"),
    },
    anatomy: { verdict: "pass", issues: [] },
    garments: garments.map((garment) => ({
      itemId: garment.itemId,
      role: garment.role,
      present: true,
      colorFidelity: "pass" as const,
      patternFidelity: "pass" as const,
      silhouetteFidelity: "pass" as const,
      constructionFidelity: "pass" as const,
      closureFidelity: "pass" as const,
      distinctiveDetailFidelity: "pass" as const,
    })),
    extraGarments: [],
    verdict: failing ? "fail" : "pass",
    correctionInstructions: failing ? ["Match the reference photo's face."] : [],
    safeSummary: failing
      ? "The generated person did not match the reference photo."
      : "The generated image matches the supplied garments.",
  };
}
