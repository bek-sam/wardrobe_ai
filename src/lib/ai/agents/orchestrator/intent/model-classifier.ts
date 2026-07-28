import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { getServerEnvironment } from "@/lib/env/server";

import { INTENT_CLASSIFICATION_PROMPT, intentClassificationSchema } from "./schema";
import type { IntentScore } from "./types";

/**
 * Whether escalation is even possible. Checked before the rolling limit is
 * charged so an unconfigured deployment spends nothing on a call it cannot
 * make -- and so the deterministic routes stay usable with no OpenAI env set.
 */
export function canClassifyWardrobeIntentWithModel() {
  const environment = getServerEnvironment();
  return Boolean(environment.OPENAI_API_KEY && environment.OPENAI_STYLIST_MODEL);
}

/**
 * Escalation for requests the keyword rules could not read confidently.
 * Returns null whenever the model is unconfigured or the call fails, so the
 * caller keeps the deterministic classification -- a real, safe route, not a
 * fabricated one -- instead of failing the whole request.
 */
export async function classifyWardrobeIntentWithModel(
  request: string,
  userId: string,
): Promise<IntentScore | null> {
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
