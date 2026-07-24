import { BOLD_KEYWORDS, MEDIUM_KEYWORDS, SUBTLE_KEYWORDS } from "./keywords.data";
import { normalize } from "./normalize";

export type PatternScale = "none" | "subtle" | "medium" | "bold";

export function classifyPatternScale(pattern: string | null): PatternScale {
  if (!pattern) return "none";
  const normalized = normalize(pattern);
  if (normalized === "solid" || normalized === "none" || normalized === "") return "none";
  if (BOLD_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "bold";
  if (SUBTLE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "subtle";
  if (MEDIUM_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "medium";
  // An unrecognized-but-non-solid pattern is treated as medium rather than
  // assumed safe, since the curator should still weigh it against the rest
  // of the outfit.
  return "medium";
}
