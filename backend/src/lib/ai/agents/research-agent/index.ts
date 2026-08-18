import { runAiTask } from "@/lib/ai/client";

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

export function researchProduct(userId: string, clues: ProductResearchClues) {
  return runAiTask<{
    result: {
      status: "verified" | "likely" | "uncertain" | "not_found";
      confidence: number;
      summary: string;
      matchedClues: string[];
      contradictions: string[];
      proposedChanges: {
        brand: string | null;
        productName: string | null;
        modelNumber: string | null;
        materials: string[];
        careInstructions: string[];
        typicalPrice: number | null;
        currency: string | null;
        releaseLine: string | null;
      };
      evidence: Array<{ claim: string; supportsFields: string[]; sourceUrl: string }>;
    };
    sources: ResearchSource[];
    responseId: string;
    usage: unknown;
  }>("product-research", { userId, clues });
}
