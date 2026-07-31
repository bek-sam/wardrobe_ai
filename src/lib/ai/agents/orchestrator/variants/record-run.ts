import type { runOutfitVariantsAgent } from "@/lib/ai/agents/outfit-variants-agent";
import type { getServerEnvironment } from "@/lib/env/server";

import { recordWardrobeOrchestratorRun } from "../record-agent-run";
import type { StylistOrchestratorInput } from "../types";
import type { OutfitVariantView } from "./variants.types";

/**
 * A safe, compact summary only: which modes were served, which candidate and
 * item IDs they used, and the provider response id. No prompt text, no
 * reasoning trace, no image data.
 */
export function recordVariantsRun(
  input: StylistOrchestratorInput,
  agent: Awaited<ReturnType<typeof runOutfitVariantsAgent>>,
  variants: readonly OutfitVariantView[],
  startedAt: number,
  environment: ReturnType<typeof getServerEnvironment>,
) {
  return recordWardrobeOrchestratorRun({
    userId: input.userId,
    inputSummary: {
      intent: "outfit_request",
      date: input.date,
      occasion: input.occasion,
      source: "variants",
      variantCount: variants.length,
    },
    outputSummary: {
      responseId: agent.responseId,
      promptVersion: agent.promptVersion,
      variants: variants.map(({ mode, candidateId, items }) => ({
        mode,
        candidateId,
        itemIds: items.map((item) => item.itemId),
      })),
    },
    model: environment.OPENAI_STYLIST_MODEL ?? "unconfigured",
    latencyMs: Date.now() - startedAt,
    usage: agent.usage ?? {},
  });
}
