import { VisualizationProviderError } from "../provider-error";

export const FAKE_OUTCOMES = ["ready", "qa_fail", "transient_once", "moderation"] as const;
export type FakeOutcome = (typeof FAKE_OUTCOMES)[number];

export function parseFakeOutcome(value: string | undefined): FakeOutcome {
  return FAKE_OUTCOMES.includes(value as FakeOutcome) ? (value as FakeOutcome) : "ready";
}

/**
 * Lets an E2E run drive the fake provider through every terminal and
 * retryable state without a network call. `transient_once` fails the first
 * attempt per process and succeeds afterwards, which is what exercises the
 * retry-then-success path end to end.
 */
export function applyScriptedFailure(outcome: FakeOutcome, attempts: Map<string, number>) {
  if (outcome === "moderation") {
    throw new VisualizationProviderError(
      "moderation_blocked",
      "The provider's safety system blocked this request. Try a different reference photo.",
    );
  }
  if (outcome !== "transient_once") return;
  const seen = attempts.get(outcome) ?? 0;
  attempts.set(outcome, seen + 1);
  if (seen === 0) {
    throw new VisualizationProviderError(
      "provider_transient",
      "The image provider is temporarily unavailable.",
    );
  }
}
