/**
 * Each failure gets its own recovery action. A blanket "Retry" on a moderation
 * block or a missing cut-out sends the user round a loop that cannot succeed,
 * so only the actions that can actually help are offered.
 */
export type FailureAction = "retry" | "change_photo" | "change_outfit" | "flat_lay";

export const FAILURE_COPY: Record<string, { title: string; actions: FailureAction[] }> = {
  configuration_missing: {
    title: "AI try-on is not available on this deployment yet.",
    actions: ["flat_lay"],
  },
  authentication: { title: "The image service rejected our credentials.", actions: ["flat_lay"] },
  unsupported_capability: {
    title: "The configured image model cannot render this outfit.",
    actions: ["change_outfit", "flat_lay"],
  },
  input_validation: {
    title: "One of the images could not be used.",
    actions: ["change_photo", "change_outfit"],
  },
  moderation_blocked: {
    title: "The safety system blocked this request.",
    actions: ["change_photo", "flat_lay"],
  },
  rate_limited: { title: "The image service is busy right now.", actions: ["retry"] },
  provider_transient: { title: "The image service is temporarily down.", actions: ["retry"] },
  timeout: { title: "The image service timed out.", actions: ["retry"] },
  invalid_output: { title: "The generated image came back unusable.", actions: ["retry"] },
  qa_rejected: {
    title: "The try-on did not pass our fidelity check, so we did not show it.",
    actions: ["retry", "change_photo"],
  },
  retry_exhausted: {
    title: "We tried several times and could not finish this try-on.",
    actions: ["change_photo", "change_outfit", "flat_lay"],
  },
  consent_revoked: { title: "AI try-on is turned off for this account.", actions: ["flat_lay"] },
};

export const DEFAULT_FAILURE = {
  title: "The try-on could not be completed.",
  actions: ["retry", "flat_lay"] as FailureAction[],
};
