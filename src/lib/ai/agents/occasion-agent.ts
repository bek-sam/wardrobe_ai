import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { occasionResolutionSchema } from "@/lib/ai/schemas/occasion";
import { getServerEnvironment } from "@/lib/env/server";
import {
  resolveOccasionContext,
  type OccasionContext,
} from "@/lib/recommendation/occasion-context";

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
