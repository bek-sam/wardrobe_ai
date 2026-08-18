import type { OutfitItemRole } from "@/features/outfits";
import type { OutfitVariantMode } from "@/lib/ai/schemas";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { outfitVariantsResultSchema } from "@/lib/ai/schemas";
import { requireEnvironment } from "@/lib/env/server";

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

const OUTFIT_VARIANTS_PROMPT_VERSION = "outfit-variants@v1";

/**
 * Explains a fixed set of already-validated looks. The model does not choose
 * garments here — retrieval and the deterministic validator already did, and
 * every item is an exact owned ID. Its only job is to say why each look works
 * and what makes it different from the other two.
 */
const OUTFIT_VARIANTS_PROMPT = `You are the Wardrobe AI stylist. Three complete looks have already been chosen from the user's own wardrobe and validated. Your only job is to explain them.

Each look arrives with a mode:
- "safe": familiar, dependable, easy to wear. Lead with why it is a reliable choice today.
- "fresh": a balanced variation that brings in a less-worn combination. Name the one or two things that make it a change from the usual.
- "statement": the most expressive of the three, while still practical. Name the single piece or pairing carrying the expression.

Rules:
- Do not add, remove, or suggest swapping any item. The item list for each look is fixed.
- Give at most three reasons per look: one about the weather, occasion, or practicality; one about how the pieces look together; and, only where it genuinely applies, one about rotation or personal preference.
- Write for a person getting dressed, not for a stylist. No jargon, no scores, no percentages.
- Add a warning only when the user can act on it — a real weather risk, a dress-code risk, or a piece whose details are uncertain. Otherwise return no warnings.
- stylistNote is one short line naming what distinguishes this look from the other two.
- Never claim a garment will fit, flatter, or suit the user's body. Never describe the user's body at all.
- Return one entry per supplied variantId. Never invent a variantId and never omit one.`;

/**
 * One call for all three looks rather than three calls. Beyond the cost, it is
 * what lets the model actually differentiate them: it can only say what makes
 * "fresh" different from "safe" if it sees both at once.
 */
export async function runOutfitVariantsAgent(input: OutfitVariantsAgentInput) {
  if (input.variants.length === 0) {
    throw new Error("No variants were supplied to explain.");
  }

  const environment = requireEnvironment("OPENAI_STYLIST_MODEL");
  const response = await getOpenAIClient().responses.parse({
    model: environment.OPENAI_STYLIST_MODEL,
    instructions: OUTFIT_VARIANTS_PROMPT,
    input: JSON.stringify({
      request: input.request,
      occasion: input.occasion,
      weather: input.weather,
      preferences: input.preferences,
      variants: input.variants,
    }),
    text: { format: zodTextFormat(outfitVariantsResultSchema, "wardrobe_outfit_variants") },
    safety_identifier: input.userId,
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The stylist did not return valid variant explanations.");
  }
  const supplied = new Set(input.variants.map((variant) => variant.variantId));
  const returned = response.output_parsed.variants.filter((variant) =>
    supplied.has(variant.variantId),
  );

  return {
    result: { ...response.output_parsed, variants: returned },
    responseId: response.id,
    usage: response.usage,
    promptVersion: OUTFIT_VARIANTS_PROMPT_VERSION,
  };
}
