/**
 * Capability profiles are keyed by *capability*, never by model name: the
 * repository forbids hard-coded model IDs, and a name-keyed table would
 * silently mis-configure the day a deployment points OPENAI_IMAGE_MODEL at a
 * different model. The deployment selects a profile explicitly through
 * OPENAI_IMAGE_CAPABILITY_PROFILE after running a non-production smoke test.
 *
 * `auto_fidelity` matches image models that apply high input fidelity
 * automatically and reject an explicit `input_fidelity` parameter.
 * `explicit_high_fidelity` matches models that require it to be sent.
 */
export const IMAGE_CAPABILITY_PROFILES = ["auto_fidelity", "explicit_high_fidelity"] as const;

export type ImageCapabilityProfileName = (typeof IMAGE_CAPABILITY_PROFILES)[number];

export type ImageCapabilityProfile = {
  /** Recorded in the freshness hash, so a profile change invalidates images. */
  version: string;
  sendInputFidelity: boolean;
  /** Portrait: full-body try-on is never rendered landscape. */
  portraitSize: "1024x1536";
  /** Total images the edit call accepts, identity reference included. */
  maxImageInputs: number;
  outputFormat: "png";
  background: "auto";
};

export const IMAGE_CAPABILITY_PROFILE_TABLE: Record<
  ImageCapabilityProfileName,
  ImageCapabilityProfile
> = {
  auto_fidelity: {
    version: "auto_fidelity@1",
    sendInputFidelity: false,
    portraitSize: "1024x1536",
    maxImageInputs: 10,
    outputFormat: "png",
    background: "auto",
  },
  explicit_high_fidelity: {
    version: "explicit_high_fidelity@1",
    sendInputFidelity: true,
    portraitSize: "1024x1536",
    maxImageInputs: 10,
    outputFormat: "png",
    background: "auto",
  },
};
