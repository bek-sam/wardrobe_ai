import type { VisualizationErrorCode } from "./provider-error";

/** HTTP status -> bounded code + safe, user-facing summary. */
export const ERROR_STATUS_SIGNATURES: ReadonlyArray<[number, VisualizationErrorCode, string]> = [
  [401, "authentication", "The image provider rejected the configured credentials."],
  [403, "authentication", "The image provider denied access to this model."],
  [429, "rate_limited", "The image provider is rate limiting requests right now."],
];

/** Message shape -> bounded code, for providers that only signal in text. */
export const ERROR_MESSAGE_SIGNATURES: ReadonlyArray<[RegExp, VisualizationErrorCode, string]> = [
  [
    /moderation|safety system|content[_ ]policy|flagged/i,
    "moderation_blocked",
    "The provider's safety system blocked this request. Try a different reference photo.",
  ],
  [
    /unsupported|unknown parameter|not supported|invalid[_ ]?value.*fidelity/i,
    "unsupported_capability",
    "The configured image model does not support the requested parameters.",
  ],
  [/timeout|timed out|ETIMEDOUT|ECONNRESET|aborted/i, "timeout", "The image provider timed out."],
  [
    /invalid[_ ]request|invalid image|could not be decoded|unsupported image/i,
    "input_validation",
    "The provider could not use one of the supplied images.",
  ],
];
