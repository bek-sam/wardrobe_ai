import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { catalogingResultSchema, type CatalogingResult } from "@/lib/ai/schemas";
import { requireEnvironment } from "@/lib/env/server";

const CATALOGING_PROMPT = `You are the visual cataloging service for a private wardrobe.

Detect each distinct garment, shoe, bag, or wearable accessory in the image. Return separate records for layered pieces when their boundaries are reasonably visible. Bounding boxes use a normalized 1000 by 1000 coordinate system and must stay inside the image.

Describe only visible properties. Apparent material is always an inference, never a fact. Transcribe visible text separately from interpretation. Never infer an exact brand from general appearance, color, monogram-like patterns, or product similarity. A logo description is not a brand identification. Do not treat a person, body, background, hanger, or furniture as a wardrobe item.

Use concise neutral names and honest field-level confidence. Return an empty garments array when no clothing or accessory can be reliably isolated.`;

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
