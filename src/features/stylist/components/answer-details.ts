import { packingLines, planLines } from "./answer-lines-plan";
import { highlightLines, matchLines } from "./answer-lines-wardrobe";

const MAX_DETAIL_LINES = 10;

const LINE_BUILDERS: Record<string, (value: Record<string, unknown>) => string[]> = {
  plan: planLines,
  packing: packingLines,
  insight: highlightLines,
  item_question: matchLines,
};

/** Compact, read-only summary lines shown under a non-outfit chat answer. */
export function buildAnswerDetails(kind: string, value: Record<string, unknown>) {
  const build = LINE_BUILDERS[kind];
  return build ? build(value).filter(Boolean).slice(0, MAX_DETAIL_LINES) : [];
}
