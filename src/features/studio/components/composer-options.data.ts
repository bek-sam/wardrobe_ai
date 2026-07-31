export const OCCASION_CHIPS = [
  "Work",
  "Casual day",
  "Dinner out",
  "Date night",
  "Wedding guest",
  "Travel day",
  "Errands",
  "Something formal",
] as const;

/**
 * Vibes are appended to the natural-language request rather than becoming a
 * hard constraint: they steer the stylist's phrasing and preference weighting
 * without ever overriding weather, dress code, or availability.
 */
export const VIBE_CHIPS = [
  "polished",
  "relaxed",
  "minimal",
  "playful",
  "romantic",
  "creative",
  "sharp",
  "cozy",
] as const;

export const SURPRISE_ME_REQUEST =
  "Surprise me with something that suits today's weather and what I usually like wearing.";
