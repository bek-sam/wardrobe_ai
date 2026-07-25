import { sanitizeNonOutfitAnswer } from "./answers";
import { isObject } from "./history-primitives";
import { sanitizeOutfitResult } from "./sanitize-outfit-result";

/**
 * Single entry point for everything the stylist may return: an outfit, or one
 * of the non-outfit answers (plan, packing list, insight, item lookup). Each
 * kind is sanitized down to renderable fields; anything else becomes null.
 */
export function sanitizeStylistStructuredResult(value: unknown) {
  if (!isObject(value)) return null;
  if (typeof value.kind === "string" && value.kind !== "outfit") {
    return sanitizeNonOutfitAnswer(value);
  }
  return sanitizeOutfitResult(value);
}
