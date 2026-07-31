import type { VisualizationOutcome } from "../api/tryon-client";

/**
 * One message per outcome. "Queue full" and "quota reached" are deliberately
 * distinct from "already ready" — collapsing them was the bug this replaces,
 * and it left users believing an image existed when none had been made.
 */
export function outcomeNotice(outcome: VisualizationOutcome): string | null {
  switch (outcome.outcome) {
    case "created":
      return "Creating your try-on. This usually takes a minute or two.";
    case "reused":
      return "A try-on for this exact look is already being made.";
    case "already_fresh":
      return null;
    case "queue_full":
      return "You already have the maximum number of try-ons in progress. Wait for one to finish.";
    case "quota_exhausted":
      return outcome.resetAt
        ? `You've used today's try-ons. They reset at ${new Date(outcome.resetAt).toLocaleTimeString()}.`
        : "You've used today's try-ons. They reset tomorrow.";
    case "conflict":
      return outcome.reason ?? "This look changed and can no longer be rendered.";
    case "needs_identity":
      return "Add a reference photo before creating a try-on.";
    case "needs_consent":
      return "Review and accept the try-on consent to continue.";
    default:
      return "The try-on could not be started.";
  }
}

export function outcomeNeedsSetup(outcome: VisualizationOutcome): boolean {
  return outcome.outcome === "needs_identity" || outcome.outcome === "needs_consent";
}
