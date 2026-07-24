import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { researchResultSchema, type ResearchResult } from "@/lib/ai/schemas/research";
import { requireEnvironment } from "@/lib/env/server";

import { collectSources } from "./collect-sources";
import { RESEARCH_AGENT_INSTRUCTIONS } from "./prompt.data";
import type { ProductResearchClues } from "./types";

export async function researchProduct(userId: string, clues: ProductResearchClues) {
  const searchableClues = [
    clues.brand,
    clues.productName,
    clues.modelNumber,
    clues.barcode,
    ...(clues.visibleText ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));
  if (searchableClues.length === 0) {
    throw new Error("Product research needs a brand, label, SKU, barcode, or visible-text clue.");
  }

  const environment = requireEnvironment("OPENAI_RESEARCH_MODEL");
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: environment.OPENAI_RESEARCH_MODEL,
    instructions: RESEARCH_AGENT_INSTRUCTIONS,
    input: `Research this user-confirmed clue set:\n${JSON.stringify(clues)}`,
    tools: [{ type: "web_search", search_context_size: "medium" }],
    include: ["web_search_call.action.sources"],
    text: { format: zodTextFormat(researchResultSchema, "wardrobe_product_research") },
    safety_identifier: userId,
    store: false,
  });

  if (!response.output_parsed) {
    throw new Error("The research model did not return a valid structured result.");
  }

  return {
    result: response.output_parsed as ResearchResult,
    sources: collectSources(response),
    responseId: response.id,
    usage: response.usage,
  };
}
