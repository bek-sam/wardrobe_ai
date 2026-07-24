import { FITTED_KEYWORDS, OVERSIZED_KEYWORDS, RELAXED_KEYWORDS } from "./keywords.data";

export type SilhouetteWeight = "fitted" | "regular" | "relaxed" | "oversized";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function classifySilhouetteWeight(
  fit: string | null,
  silhouette: string | null,
): SilhouetteWeight {
  const combined = `${fit ?? ""} ${silhouette ?? ""}`.trim();
  if (!combined) return "regular";
  const normalized = normalize(combined);
  if (OVERSIZED_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "oversized";
  if (FITTED_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "fitted";
  if (RELAXED_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "relaxed";
  return "regular";
}
