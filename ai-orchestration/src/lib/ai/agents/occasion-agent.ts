import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { getServerEnvironment } from "@/lib/env/server";
import { resolveOccasionContext, type OccasionContext } from "@/lib/recommendation";
import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  INDOOR_OUTDOOR_VALUES,
  OCCASION_CATEGORIES,
  TIMES_OF_DAY,
} from "@/lib/recommendation";

const occasionResolutionSchema = z
  .object({
    category: z.enum(OCCASION_CATEGORIES),
    targetFormality: z.number().int().min(1).max(5),
    indoorOutdoor: z.enum(INDOOR_OUTDOOR_VALUES),
    activityLevel: z.enum(ACTIVITY_LEVELS),
    timeOfDay: z.enum(TIMES_OF_DAY),
    dressCodeConstraints: z.array(z.string().min(1).max(80)).max(5),
    confidence: z.number().min(0).max(1),
    unresolvedQuestions: z.array(z.string().min(1).max(200)).max(3),
  })
  .strict();

const ESCALATION_CONFIDENCE_THRESHOLD = 0.5;

const OCCASION_RESOLUTION_PROMPT = `You classify a short, free-form description of an occasion into a fixed
set of normalized fields a wardrobe styling system uses for filtering. Pick
exactly one category from the fixed enum (never invent a new one; use
"casual" if nothing else clearly fits). Set targetFormality on a 1-5 scale
(1 = very casual, 5 = black tie/formal). Only include a dressCodeConstraint
string when the text explicitly states one (e.g. "black tie", "no jeans") --
never infer one from the category alone. List concise unresolvedQuestions
only for information a stylist would actually need to ask the user for
because the text left it genuinely ambiguous; return an empty array when the
request is already clear enough to act on.`;

/**
 * Deterministic rules (resolveOccasionContext) handle the vast majority of
 * requests; this only escalates to a structured model call when that
 * deterministic pass was low-confidence and free text was actually supplied,
 * for cases plain keyword matching can't reliably disambiguate. Any missing
 * config or model failure falls back to the deterministic result, which is
 * already a safe, legitimate default -- not fabricated data -- so this never
 * needs to fail closed the way a feature with no non-AI fallback would.
 */
export async function resolveOccasionContextWithEscalation(
  rawText: string | null | undefined,
  userId: string,
): Promise<OccasionContext> {
  const deterministic = resolveOccasionContext(rawText);
  const text = rawText?.trim();
  if (!text || deterministic.confidence >= ESCALATION_CONFIDENCE_THRESHOLD) {
    return deterministic;
  }

  const environment = getServerEnvironment();
  if (!environment.OPENAI_API_KEY || !environment.OPENAI_STYLIST_MODEL) {
    return deterministic;
  }

  try {
    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model: environment.OPENAI_STYLIST_MODEL,
      instructions: OCCASION_RESOLUTION_PROMPT,
      input: [{ role: "user", content: [{ type: "input_text", text }] }],
      text: { format: zodTextFormat(occasionResolutionSchema, "occasion_resolution") },
      safety_identifier: userId,
      store: false,
    });
    if (!response.output_parsed) return deterministic;
    return { ...response.output_parsed, matchedKeywords: deterministic.matchedKeywords };
  } catch {
    return deterministic;
  }
}
