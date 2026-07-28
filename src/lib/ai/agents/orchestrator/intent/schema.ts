import { z } from "zod";

import { WARDROBE_INTENTS } from "./types";

export const intentClassificationSchema = z
  .object({
    intent: z.enum(WARDROBE_INTENTS),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const INTENT_CLASSIFICATION_PROMPT = `You route a wardrobe assistant request to exactly one handler.
Pick "outfit_request" when the user wants one outfit for one occasion or day.
Pick "planning" when the user wants outfits for several dates (a week, a
multi-day stretch, "each day"). Pick "packing" only for travel: a trip, a
suitcase, or what to bring somewhere. Pick "insight" when the user asks about
their wearing habits or wardrobe composition (unworn items, most/least worn,
cost per wear, gaps). Pick "item_question" when the user asks whether they own
something, how many they own, or asks to find or list owned items. When two
readings are plausible, prefer "outfit_request". Report calibrated confidence.`;
