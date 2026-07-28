import { isObject, safeString } from "@/lib/api/normalize";

import { buildAnswerDetails } from "./answer-details";
import { uuidPattern } from "./stylist-constants.data";

/** Everything the transcript needs to render (and act on) one plan answer. */
export type PlanAnswerAction = { generationId: string; saved: boolean };

export type StylistAnswerMessage = {
  kind: string;
  answer: string;
  details: string[];
  /**
   * Present only for a saveable planning answer. Packing lists, insights, item
   * questions, and outfits never carry one, so no save action can appear for
   * them -- and neither can a plan whose generation was not recorded.
   */
  plan: PlanAnswerAction | null;
};

function planAction(kind: string, value: Record<string, unknown>): PlanAnswerAction | null {
  if (kind !== "plan") return null;
  const generationId = safeString(value.generationId);
  if (!uuidPattern.test(generationId)) return null;
  return { generationId, saved: value.saved === true };
}

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
  return {
    kind,
    answer: answer.slice(0, 1_200),
    details: buildAnswerDetails(kind, value),
    plan: planAction(kind, value),
  };
}
