/**
 * What the stylist workspace can actually do right now.
 *
 * Chat itself only needs an account: the wardrobe-lookup and insight routes
 * answer from the user's own rows and call no model, so the composer stays
 * usable with every OpenAI variable unset. The generation flags gate only the
 * routes that genuinely need a model, and the server still refuses those
 * routes independently -- these flags shape the UI, they do not enforce it.
 */
export type StylistCapabilities = {
  /** Supabase and its server-side configuration are present. */
  chatAvailable: boolean;
  /** OPENAI_API_KEY + OPENAI_STYLIST_MODEL: outfit requests. */
  outfitGenerationAvailable: boolean;
  /** OPENAI_API_KEY + OPENAI_PLANNER_MODEL: planning and packing. */
  planGenerationAvailable: boolean;
};

/** True when at least one model-backed route is configured. */
export function hasGenerationCapability(capabilities: StylistCapabilities) {
  return capabilities.outfitGenerationAvailable || capabilities.planGenerationAvailable;
}

/** True when only the deterministic, zero-model routes are available. */
export function isDeterministicOnly(capabilities: StylistCapabilities) {
  return capabilities.chatAvailable && !hasGenerationCapability(capabilities);
}
