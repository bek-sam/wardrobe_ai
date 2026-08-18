import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { requireEnvironment } from "@/lib/env/server";
import { z } from "zod";

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
): ResearchSource[] {
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

const researchStatusSchema = z.enum(["verified", "likely", "uncertain", "not_found"]);

const researchResultSchema = z
  .object({
    status: researchStatusSchema,
    confidence: z.number().min(0).max(1),
    summary: z.string().max(1_200),
    matchedClues: z.array(z.string().min(1).max(180)).max(16),
    contradictions: z.array(z.string().min(1).max(180)).max(16),
    proposedChanges: z
      .object({
        brand: z.string().max(120).nullable(),
        productName: z.string().max(160).nullable(),
        modelNumber: z.string().max(100).nullable(),
        materials: z.array(z.string().min(1).max(100)).max(12),
        careInstructions: z.array(z.string().min(1).max(180)).max(16),
        typicalPrice: z.number().nonnegative().nullable(),
        currency: z.string().length(3).nullable(),
        releaseLine: z.string().max(160).nullable(),
      })
      .strict(),
    evidence: z
      .array(
        z
          .object({
            claim: z.string().min(1).max(260),
            supportsFields: z.array(z.string().min(1).max(80)).max(12),
            sourceUrl: z
              .url()
              .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
          })
          .strict(),
      )
      .max(24),
  })
  .strict();

type ResearchResult = z.infer<typeof researchResultSchema>;

const RESEARCH_AGENT_INSTRUCTIONS =
  "Research a possible clothing product identity. Search official brand sources first and reliable retailers second. A visually similar item is never proof of identity. Distinguish verified facts from likely or uncertain matches, report contradictions, and return not_found when clues are insufficient. Every proposed fact must cite a source URL. Never silently treat a proposal as user-confirmed data.";

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
