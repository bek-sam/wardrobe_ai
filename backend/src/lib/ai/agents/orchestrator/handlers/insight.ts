import { buildUnwornItems, buildWardrobeInsights, fetchInsightItems } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";

import type { InsightAnswer } from "..";
import type { ResolvedIntent } from "../intent";
import { recordWardrobeOrchestratorRun } from "..";
import type { StylistOrchestratorInput } from "..";
import { buildInsightHighlights } from "./support";
import { insightAnswerText } from "./support";

/** Wear-history and composition questions: fully deterministic, no model. */
export async function answerInsightRequest(
  input: StylistOrchestratorInput,
  resolved: ResolvedIntent,
): Promise<InsightAnswer> {
  const startedAt = Date.now();
  const supabase = await createClient();
  const items = await fetchInsightItems(supabase, input.userId);
  const insights = buildWardrobeInsights(items);
  const unworn = buildUnwornItems(items, resolved.unwornSince, input.date);
  const highlights = buildInsightHighlights(resolved.insightFocus, insights, unworn);
  const stats = {
    itemCount: insights.itemCount,
    neverWornCount: insights.neverWorn.length,
    unwornCount: unworn.length,
    possibleFoundations: insights.possibleFoundations,
  };

  const generationId = await recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent: "insight",
      source: "insights",
      focus: resolved.insightFocus,
      since: resolved.unwornSince,
    },
    outputSummary: { stats, highlightCount: highlights.length },
    model: "deterministic",
    latencyMs: Date.now() - startedAt,
    usage: {},
  });

  return {
    kind: "insight",
    intent: "insight",
    generationId,
    answer: insightAnswerText(resolved.insightFocus, stats, resolved.unwornSince, highlights),
    focus: resolved.insightFocus,
    since: resolved.unwornSince,
    highlights,
    stats,
  };
}
