import { runAiTask } from "@/lib/ai/client";
import type { CatalogingResult } from "@/lib/ai/schemas";

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

export function catalogGarments(input: CatalogingInput): Promise<CatalogingAgentResult> {
  return runAiTask("catalog-garments", input);
}
