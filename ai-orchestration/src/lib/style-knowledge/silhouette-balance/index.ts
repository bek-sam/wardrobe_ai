export type SilhouetteWeight = "fitted" | "regular" | "relaxed" | "oversized";

const FITTED_KEYWORDS = ["fitted", "slim", "skinny", "tight", "bodycon", "tailored"];
const RELAXED_KEYWORDS = ["relaxed", "loose", "wide", "wide-leg", "wide leg", "baggy"];
const OVERSIZED_KEYWORDS = ["oversized", "oversize", "boxy"];

export function classifySilhouetteWeight(
  fit: string | null,
  silhouette: string | null,
): SilhouetteWeight {
  const combined = `${fit ?? ""} ${silhouette ?? ""}`.trim().toLowerCase();
  if (!combined) return "regular";
  if (OVERSIZED_KEYWORDS.some((keyword) => combined.includes(keyword))) return "oversized";
  if (FITTED_KEYWORDS.some((keyword) => combined.includes(keyword))) return "fitted";
  if (RELAXED_KEYWORDS.some((keyword) => combined.includes(keyword))) return "relaxed";
  return "regular";
}

export function evaluateSilhouetteBalance(
  topWeight: SilhouetteWeight,
  bottomWeight: SilhouetteWeight,
): { balanced: boolean; guidance: string } {
  if (topWeight === bottomWeight) {
    if (topWeight === "oversized") {
      return {
        balanced: false,
        guidance:
          "Oversized on oversized reads as shapeless unless it's a single dress silhouette.",
      };
    }
    if (topWeight === "fitted") {
      return {
        balanced: true,
        guidance:
          "Fitted top and bottom is a sleek, low-visual-interest but still balanced silhouette.",
      };
    }
    return {
      balanced: true,
      guidance: "Consistent proportions throughout -- clean, if unremarkable.",
    };
  }

  const isDeliberateContrast =
    (topWeight === "fitted" && (bottomWeight === "relaxed" || bottomWeight === "oversized")) ||
    (bottomWeight === "fitted" && (topWeight === "relaxed" || topWeight === "oversized"));
  if (isDeliberateContrast) {
    return {
      balanced: true,
      guidance: "Fitted paired with relaxed/oversized creates deliberate proportion play.",
    };
  }
  if (topWeight === "oversized" && bottomWeight === "relaxed") {
    return {
      balanced: false,
      guidance: "Oversized top with a relaxed bottom risks reading as shapeless overall.",
    };
  }
  return {
    balanced: true,
    guidance: "Differing but moderate silhouette weights -- generally balanced.",
  };
}
