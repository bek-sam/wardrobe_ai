import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { CATALOGING_PROMPT } from "@/lib/ai/prompts/cataloging";
import { catalogingResultSchema, type CatalogingResult } from "@/lib/ai/schemas/cataloging";
import { requireEnvironment } from "@/lib/env/server";

export type CatalogingInput = {
  image: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  userId: string;
  hint?: string | null;
};

export type CatalogingAgentResult = {
  result: CatalogingResult;
  responseId: string;
  usage: unknown;
};

export async function catalogGarments(input: CatalogingInput): Promise<CatalogingAgentResult> {
  const environment = requireEnvironment("OPENAI_VISION_MODEL");
  const client = getOpenAIClient();
  const hint = input.hint?.trim() ? `\nUser-provided context: ${input.hint.trim()}` : "";
  const imageUrl = `data:${input.mimeType};base64,${input.image.toString("base64")}`;

  const response = await client.responses.parse({
    model: environment.OPENAI_VISION_MODEL,
    instructions: CATALOGING_PROMPT,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Catalog every distinct wardrobe item in this image.${hint}`,
          },
          { type: "input_image", image_url: imageUrl, detail: "high" },
        ],
      },
    ],
    text: { format: zodTextFormat(catalogingResultSchema, "wardrobe_catalog") },
    safety_identifier: input.userId,
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The cataloging model did not return valid structured metadata.");
  }

  return { result: response.output_parsed, responseId: response.id, usage: response.usage };
}
