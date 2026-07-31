import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { VISUALIZATION_ASSESSMENT_PROMPT } from "@/lib/ai/prompts/outfit-visualization";
import { requireEnvironment } from "@/lib/env/server";
import { visualizationAssessmentSchema, type VisualizationAssessment } from "@/lib/visualization";

import { normalizeVisualizationProviderError } from "../normalize-error";
import { VisualizationProviderError } from "../provider-error";
import type { AssessVisualizationInput } from "../types";
import { dataUrl, garmentAssessmentContext } from "./garment-context";

export async function assessWithOpenAI(
  input: AssessVisualizationInput,
): Promise<VisualizationAssessment> {
  const environment = requireEnvironment("OPENAI_VISUALIZATION_QA_MODEL");
  try {
    const response = await getOpenAIClient().responses.parse({
      model: environment.OPENAI_VISUALIZATION_QA_MODEL,
      instructions: VISUALIZATION_ASSESSMENT_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Supplied garments:\n${JSON.stringify(garmentAssessmentContext(input.garments))}\n\nThe first image is the generated try-on. The second image is the identity reference.`,
            },
            { type: "input_image", image_url: dataUrl(input.image), detail: "high" },
            { type: "input_image", image_url: dataUrl(input.identity), detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(visualizationAssessmentSchema, "visualization_assessment") },
      safety_identifier: input.userId,
      store: false,
    });
    if (!response.output_parsed) {
      throw new VisualizationProviderError(
        "invalid_output",
        "The fidelity check did not return a usable result.",
      );
    }
    return response.output_parsed;
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}
