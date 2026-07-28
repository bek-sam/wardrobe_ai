import { nonOutfitAnswerSchema, type SanitizedNonOutfitAnswer } from "./schemas";

/**
 * Reduces a stored plan/packing/insight/item answer to the fields the product
 * UI renders. Returns null for anything that does not parse, so a malformed
 * or legacy row is simply not shown rather than partially trusted.
 */
export function sanitizeNonOutfitAnswer(value: unknown): SanitizedNonOutfitAnswer | null {
  const parsed = nonOutfitAnswerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
