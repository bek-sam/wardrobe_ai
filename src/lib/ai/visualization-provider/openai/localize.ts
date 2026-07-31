import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { VISUALIZATION_LOCALIZATION_PROMPT } from "@/lib/ai/prompts/outfit-visualization";
import { requireEnvironment } from "@/lib/env/server";
import {
  visualizationLocalizationSchema,
  type VisualizationLocalization,
} from "@/lib/visualization";

import { normalizeVisualizationProviderError } from "../normalize-error";
import type { LocalizeVisualizationInput } from "../types";
import { dataUrl, garmentAssessmentContext } from "./garment-context";

/**
 * Runs after the QA gate accepts an image. Failure here is never fatal — the
 * caller falls back to deterministic body zones and the chip list, which is
 * why this returns an empty region set rather than throwing on a bad parse.
 */
export async function localizeWithOpenAI(
  input: LocalizeVisualizationInput,
): Promise<VisualizationLocalization> {
  const environment = requireEnvironment("OPENAI_VISUALIZATION_QA_MODEL");
  try {
    const response = await getOpenAIClient().responses.parse({
      model: environment.OPENAI_VISUALIZATION_QA_MODEL,
      instructions: VISUALIZATION_LOCALIZATION_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Locate each of these garments in the image:\n${JSON.stringify(garmentAssessmentContext(input.garments))}`,
            },
            { type: "input_image", image_url: dataUrl(input.image), detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(visualizationLocalizationSchema, "garment_localization") },
      safety_identifier: input.userId,
      store: false,
    });
    return response.output_parsed ?? { regions: [] };
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}
