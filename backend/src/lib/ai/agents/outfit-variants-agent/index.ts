import type { OutfitItemRole } from "@/features/outfits";
import type { OutfitVariantMode } from "@/lib/ai/schemas";
import { runAiTask } from "@/lib/ai/client";
import type { OutfitVariantsResult } from "@/lib/ai/schemas";

export type VariantItemInput = {
  itemId: string;
  role: OutfitItemRole;
  name: string;
  category: string;
  colors: readonly string[];
  pattern: string | null;
  fit: string | null;
  silhouette: string | null;
  warmthLevel: number | null;
  formalityLevel: number | null;
  wearCount: number;
  lastWornAt: string | null;
};

export type VariantInput = {
  variantId: string;
  mode: OutfitVariantMode;
  items: readonly VariantItemInput[];
};

export type OutfitVariantsAgentInput = {
  userId: string;
  request: string;
  occasion: string | null;
  weather: unknown;
  preferences: unknown;
  variants: readonly VariantInput[];
};

/**
 * One call for all three looks rather than three calls. Beyond the cost, it is
 * what lets the model actually differentiate them: it can only say what makes
 * "fresh" different from "safe" if it sees both at once.
 */
export async function runOutfitVariantsAgent(input: OutfitVariantsAgentInput) {
  if (input.variants.length === 0) {
    throw new Error("No variants were supplied to explain.");
  }

  const response = await runAiTask<{
    result: OutfitVariantsResult;
    responseId: string;
    usage: unknown;
    promptVersion: string;
  }>("explain-variants", input);
  const supplied = new Set(input.variants.map((variant) => variant.variantId));
  const returned = response.result.variants.filter((variant) => supplied.has(variant.variantId));

  return {
    result: { ...response.result, variants: returned },
    responseId: response.responseId,
    usage: response.usage,
    promptVersion: response.promptVersion,
  };
}
