import { isObject, safeString } from "@/lib/api/normalize";

import { buildAnswerDetails } from "./answer-details";

export type StylistAnswerMessage = {
  kind: string;
  answer: string;
  details: string[];
};

/**
 * Non-outfit stylist answers (plan, packing, insight, item lookup). Outfit
 * results return null here so the recommendation panel keeps owning them.
 */
export function normalizeStylistAnswer(value: unknown): StylistAnswerMessage | null {
  if (!isObject(value)) return null;
  const kind = safeString(value.kind);
  if (!kind || kind === "outfit") return null;
  const answer = safeString(value.answer).trim();
  if (!answer) return null;
  return { kind, answer: answer.slice(0, 1_200), details: buildAnswerDetails(kind, value) };
}
