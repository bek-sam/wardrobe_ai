import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { researchResultSchema, type ResearchResult } from "@/lib/ai/schemas/research";
import { requireEnvironment } from "@/lib/env/server";

export type ProductResearchClues = {
  brand?: string | null;
  productName?: string | null;
  visibleText?: readonly string[];
  modelNumber?: string | null;
  barcode?: string | null;
  category?: string | null;
  colors?: readonly string[];
  description?: string | null;
};

export type ResearchSource = { title: string; url: string; domain: string };

function collectSources(
  response: Awaited<ReturnType<ReturnType<typeof getOpenAIClient>["responses"]["parse"]>>,
) {
  const sources = new Map<string, ResearchSource>();
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations) {
        if (annotation.type !== "url_citation") continue;
        try {
          const parsed = new URL(annotation.url);
          if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) continue;
          const domain = parsed.hostname.replace(/^www\./, "");
          sources.set(annotation.url, { title: annotation.title, url: annotation.url, domain });
        } catch {
          // Ignore malformed citations instead of persisting an unsafe URL.
        }
      }
    }
  }
  return [...sources.values()];
}

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
    instructions: `Research a possible clothing product identity. Search official brand sources first and reliable retailers second. A visually similar item is never proof of identity. Distinguish verified facts from likely or uncertain matches, report contradictions, and return not_found when clues are insufficient. Every proposed fact must cite a source URL. Never silently treat a proposal as user-confirmed data.`,
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
