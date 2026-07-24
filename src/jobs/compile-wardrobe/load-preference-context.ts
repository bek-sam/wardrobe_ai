import { buildPreferenceEvidence } from "./build-preference-evidence";
import { fetchStyleAndFeedback } from "./fetch-style-and-feedback";
import type { AdminClient } from "./types";

export async function loadPreferenceContext(admin: AdminClient, userId: string) {
  const { style, feedbackRows, outfitItems } = await fetchStyleAndFeedback(admin, userId);
  const evidence = buildPreferenceEvidence(feedbackRows, outfitItems);

  return {
    favoriteColors: (style?.favorite_colors ?? []) as string[],
    avoidedColors: (style?.avoided_colors ?? []) as string[],
    preferredFits: (style?.preferred_fits ?? []) as string[],
    styleKeywords: (style?.style_keywords ?? []) as string[],
    styleArchetypes: (style?.style_archetypes ?? []) as string[],
    preferenceVersion: (style?.updated_at as string | undefined) ?? "none",
    likedItemIds: evidence.likedItemIds,
    dislikedItemIds: evidence.dislikedItemIds,
  };
}

export type PreferenceContext = Awaited<ReturnType<typeof loadPreferenceContext>>;
