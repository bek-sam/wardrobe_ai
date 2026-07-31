import type { SwapCandidate } from "../api/item-actions";
import type { StudioVariant, StudioVariantsResponse } from "../types";

/**
 * Replaces one garment in one variant, keeping its role and position. A swap
 * is local and immediate — the flat lay updates at once — and the server still
 * revalidates the whole look before anything is saved or rendered.
 */
export function applySwap(
  result: StudioVariantsResponse,
  candidateId: string,
  fromItemId: string,
  replacement: SwapCandidate,
): StudioVariantsResponse {
  const swapVariant = (variant: StudioVariant): StudioVariant => {
    if (variant.candidateId !== candidateId) return variant;
    return {
      ...variant,
      items: variant.items.map((item) =>
        item.itemId === fromItemId
          ? {
              ...item,
              itemId: replacement.id,
              name: replacement.name,
              category: replacement.category,
              // Colours and pattern are unknown from the picker's compact
              // record; the detail sheet reads the authoritative values from
              // the wardrobe row, so leaving them empty is honest rather than
              // inventing them here.
              colorNames: [],
              primaryColorHex: null,
              pattern: null,
              availabilityStatus: "available",
              favorite: false,
              wearCount: 0,
            }
          : item,
      ),
      // A swapped look is no longer the one the stylist explained, so the
      // stylist note is dropped rather than left attached to a different look.
      stylistNote: "You swapped a piece into this look.",
    };
  };

  return { ...result, variants: result.variants.map(swapVariant) };
}
