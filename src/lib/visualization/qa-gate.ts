import { garmentQaFailures } from "./qa-garment-failures";
import type { VisualizationAssessment } from "./schemas";

export type QaGateResult =
  | { verdict: "pass"; reasons: [] }
  | { verdict: "correctable"; reasons: string[] }
  | { verdict: "fail"; reasons: string[] };

/**
 * The deterministic gate applied *after* the model's own assessment: the model
 * proposes, this decides. No generated image reaches `ready` without passing
 * here, so a wrong-identity, multi-person, or missing-foundation render can
 * never be served as a normal result.
 */
export function evaluateQaGate(assessment: VisualizationAssessment): QaGateResult {
  const terminal: string[] = [];
  if (assessment.identity.recognizableMatch === "fail") {
    terminal.push("The rendered person does not match your reference photo.");
  }
  if (!assessment.framing.singlePerson) terminal.push("The image contains more than one person.");
  if (assessment.anatomy.verdict === "fail") terminal.push("The rendered pose is not usable.");

  const correctable = garmentQaFailures(assessment);
  if (!assessment.framing.fullBodyVisible || !assessment.framing.headVisible) {
    correctable.push("The framing cut off part of the body.");
  }
  if (assessment.extraGarments.length > 0) {
    correctable.push("The image added a garment that is not in this outfit.");
  }

  if (terminal.length > 0) return { verdict: "fail", reasons: [...terminal, ...correctable] };
  if (correctable.length > 0) return { verdict: "correctable", reasons: correctable };
  if (assessment.verdict === "fail") return { verdict: "fail", reasons: [assessment.safeSummary] };
  if (assessment.verdict === "correctable") {
    return { verdict: "correctable", reasons: [assessment.safeSummary] };
  }
  return { verdict: "pass", reasons: [] };
}
