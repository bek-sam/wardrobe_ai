import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { getServerEnvironment } from "@/lib/env/server";

const MODEL_INTENTS = [
  "outfit_request",
  "planning",
  "packing",
  "insight",
  "item_question",
] as const;

type ModelIntentScore = {
  intent: (typeof MODEL_INTENTS)[number];
  confidence: number;
};

const intentClassificationSchema = z
  .object({
    intent: z.enum(MODEL_INTENTS),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const INTENT_CLASSIFICATION_PROMPT = `You route a wardrobe assistant request to exactly one handler.
Pick "outfit_request" when the user wants one outfit for one occasion or day.
Pick "planning" when the user wants outfits for several dates (a week, a
multi-day stretch, "each day"). Pick "packing" only for travel: a trip, a
suitcase, or what to bring somewhere. Pick "insight" when the user asks about
their wearing habits or wardrobe composition (unworn items, most/least worn,
cost per wear, gaps). Pick "item_question" when the user asks whether they own
something, how many they own, or asks to find or list owned items. When two
readings are plausible, prefer "outfit_request". Report calibrated confidence.`;

export function canClassifyWardrobeIntentWithModel() {
  const environment = getServerEnvironment();
  return Boolean(environment.OPENAI_API_KEY && environment.OPENAI_STYLIST_MODEL);
}

/** External model boundary kept isolated so failures and tests can replace it. */
export async function classifyWardrobeIntentWithModel(
  request: string,
  userId: string,
): Promise<ModelIntentScore | null> {
  const environment = getServerEnvironment();
  if (!canClassifyWardrobeIntentWithModel()) return null;

  try {
    const response = await getOpenAIClient().responses.parse({
      model: environment.OPENAI_STYLIST_MODEL,
      instructions: INTENT_CLASSIFICATION_PROMPT,
      input: [{ role: "user", content: [{ type: "input_text", text: request.slice(0, 2_000) }] }],
      text: { format: zodTextFormat(intentClassificationSchema, "wardrobe_intent") },
      safety_identifier: userId,
      store: false,
    });
    return response.output_parsed ?? null;
  } catch {
    return null;
  }
}
