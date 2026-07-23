import { commaSeparated } from "./settings-helpers";
import type { StyleFormState } from "./settings.types";

export function buildStylePayload(form: StyleFormState) {
  return {
    style_keywords: form.styles,
    common_activities: form.activities,
    favorite_colors: commaSeparated(form.favoriteColors),
    avoided_colors: commaSeparated(form.avoidedColors),
    preferred_fits: commaSeparated(form.preferredFits),
    preferred_formality: form.formality ? Number(form.formality) : null,
    runs_cold: form.temperatureComfort === "cold" ? true : null,
    runs_hot: form.temperatureComfort === "hot" ? true : null,
    size_profile: {
      ...(form.topSize.trim() ? { top: form.topSize.trim() } : {}),
      ...(form.bottomSize.trim() ? { bottom: form.bottomSize.trim() } : {}),
      ...(form.dressSize.trim() ? { dress: form.dressSize.trim() } : {}),
      ...(form.shoeSize.trim() ? { shoes: form.shoeSize.trim() } : {}),
    },
    modesty_preferences: form.coverageNotes.trim() ? { notes: form.coverageNotes.trim() } : {},
    notes: form.styleNote.trim(),
  };
}
