import type { FoundationMode } from "./outfits-manager.types";

export function outfitValidationMessage(
  name: string,
  missingFoundation: boolean,
  foundation: FoundationMode,
  hasDuplicate: boolean,
): string | null {
  if (!name.trim()) return "Name this outfit before saving.";
  if (missingFoundation) {
    return foundation === "dress"
      ? "Select one dress for the outfit foundation."
      : "Select one top and one bottom for the outfit foundation.";
  }
  if (hasDuplicate) return "Each garment can be selected only once.";
  return null;
}
