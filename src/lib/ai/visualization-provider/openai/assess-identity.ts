import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { IDENTITY_REFERENCE_PROMPT } from "@/lib/ai/prompts/outfit-visualization";
import { requireEnvironment } from "@/lib/env/server";
import {
  identityReferenceAssessmentSchema,
  type IdentityReferenceAssessment,
} from "@/lib/visualization";

import { normalizeVisualizationProviderError } from "../normalize-error";
import { VisualizationProviderError } from "../provider-error";
import type { AssessIdentityInput } from "../types";
import { dataUrl } from "./garment-context";

export async function assessIdentityWithOpenAI(
  input: AssessIdentityInput,
): Promise<IdentityReferenceAssessment> {
  const environment = requireEnvironment("OPENAI_VISUALIZATION_QA_MODEL");
  try {
    const response = await getOpenAIClient().responses.parse({
      model: environment.OPENAI_VISUALIZATION_QA_MODEL,
      instructions: IDENTITY_REFERENCE_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Assess this photo's suitability as a reference." },
            { type: "input_image", image_url: dataUrl(input.image), detail: "high" },
          ],
        },
      ],
      text: {
        format: zodTextFormat(identityReferenceAssessmentSchema, "identity_reference_assessment"),
      },
      safety_identifier: input.userId,
      store: false,
    });
    if (!response.output_parsed) {
      throw new VisualizationProviderError(
        "invalid_output",
        "The photo check did not return a usable result.",
      );
    }
    return response.output_parsed;
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}
