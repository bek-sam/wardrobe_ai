import { createClient } from "@/lib/supabase/server";
import { searchWardrobeItems } from "@/lib/wardrobe-search";

import type { ItemQuestionAnswer } from "..";
import type { ResolvedIntent } from "../intent";
import { recordWardrobeOrchestratorRun } from "..";
import type { StylistOrchestratorInput } from "..";
import { itemAnswerText } from "./support";

/**
 * "Do I own a blue blazer?" is answered from the wardrobe itself: a
 * user-scoped lookup ranked deterministically, never a generated guess.
 */
export async function answerItemQuestion(
  input: StylistOrchestratorInput,
  resolved: ResolvedIntent,
): Promise<ItemQuestionAnswer> {
  const startedAt = Date.now();
  const supabase = await createClient();
  const result = await searchWardrobeItems(supabase, input.userId, resolved.itemQuery);

  const generationId = await recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent: "item_question",
      source: "wardrobe_search",
      terms: resolved.itemQuery.terms,
      colors: resolved.itemQuery.colors,
      categories: resolved.itemQuery.categories,
    },
    outputSummary: {
      matchCount: result.matchCount,
      itemIds: result.matches.map((match) => match.itemId),
    },
    model: "deterministic",
    latencyMs: Date.now() - startedAt,
    usage: {},
  });

  return {
    kind: "item_question",
    intent: "item_question",
    generationId,
    answer: itemAnswerText(resolved.itemQuery, result),
    query: resolved.itemQuery.raw,
    matches: result.matches,
    matchCount: result.matchCount,
  };
}
