import { catalogGarments } from "@/lib/ai/agents/cataloging-agent";
import { resolveOccasionContextWithEscalation } from "@/lib/ai/agents/occasion-agent";
import { classifyWardrobeIntentWithModel } from "@/lib/ai/agents/orchestrator/intent/model-classifier";
import { runOutfitCuratorAgent } from "@/lib/ai/agents/outfit-curator-agent";
import { runOutfitVariantsAgent } from "@/lib/ai/agents/outfit-variants-agent";
import { runPlannerAgent } from "@/lib/ai/agents/planner-agent";
import { researchProduct, type ProductResearchClues } from "@/lib/ai/agents/research-agent";
import { explainWardrobeCandidate, runStylistAgent } from "@/lib/ai/agents/stylist-agent";
import { extractGarment, generateModeledPreview } from "@/lib/ai/image-service";
import { resolveVisualizationProvider } from "@/lib/ai/visualization-provider";
import type { AiTaskName } from "@wardrobe/contracts";

export const AI_TASKS = [
  "catalog-garments",
  "occasion",
  "classify-intent",
  "curate-outfits",
  "explain-variants",
  "plan",
  "product-research",
  "select-outfit",
  "explain-outfit",
  "extract-garment",
  "modeled-preview",
  "visualization-generate",
  "visualization-assess",
  "visualization-localize",
  "identity-assess",
] as const satisfies readonly AiTaskName[];

export type AiTask = (typeof AI_TASKS)[number];

type EncodedBuffer = { __buffer: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class TaskInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskInputError";
  }
}

/** JSON-only private transport; raw bytes are explicitly tagged and bounded by Fastify's body limit. */
export function decodeTaskValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeTaskValue);
  if (!isRecord(value)) return value;
  if (Object.keys(value).length === 1 && typeof value.__buffer === "string") {
    return Buffer.from(value.__buffer, "base64");
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, decodeTaskValue(item)]),
  );
}

export function encodeTaskValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return { __buffer: value.toString("base64") } satisfies EncodedBuffer;
  if (Array.isArray(value)) return value.map(encodeTaskValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, encodeTaskValue(item)]),
  );
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0 || value.length > 2_000) {
    throw new TaskInputError(`Task input needs a bounded ${key}.`);
  }
  return value;
}

function validateTaskValue(value: unknown, depth = 0): void {
  if (depth > 12) throw new TaskInputError("Task input is too deeply nested.");
  if (Buffer.isBuffer(value)) {
    if (value.byteLength > 32 * 1024 * 1024)
      throw new TaskInputError("An image input is too large.");
    return;
  }
  if (typeof value === "string" && value.length > 100_000) {
    throw new TaskInputError("A text input is too large.");
  }
  if (Array.isArray(value)) {
    if (value.length > 5_000) throw new TaskInputError("A task array is too large.");
    for (const item of value) validateTaskValue(item, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  const entries = Object.entries(value);
  if (entries.length > 5_000) throw new TaskInputError("A task object has too many fields.");
  for (const [key, item] of entries) {
    if (["__proto__", "prototype", "constructor"].includes(key)) {
      throw new TaskInputError("Task input contains a forbidden field.");
    }
    validateTaskValue(item, depth + 1);
  }
}

export async function runAiTask(task: AiTask, encodedInput: unknown): Promise<unknown> {
  const decoded = decodeTaskValue(encodedInput);
  if (!isRecord(decoded)) throw new TaskInputError("Task input must be an object.");
  validateTaskValue(decoded);
  // Every task is scoped to one authenticated application user. AI
  // Orchestration does not trust or persist this identity; it passes it only as
  // provider abuse/audit metadata.
  requiredString(decoded, "userId");

  switch (task) {
    case "catalog-garments":
      return catalogGarments(decoded as unknown as Parameters<typeof catalogGarments>[0]);
    case "occasion":
      return resolveOccasionContextWithEscalation(
        typeof decoded.rawText === "string" ? decoded.rawText : null,
        requiredString(decoded, "userId"),
      );
    case "classify-intent":
      return classifyWardrobeIntentWithModel(
        requiredString(decoded, "request"),
        requiredString(decoded, "userId"),
      );
    case "curate-outfits":
      return runOutfitCuratorAgent(
        decoded as unknown as Parameters<typeof runOutfitCuratorAgent>[0],
      );
    case "explain-variants":
      return runOutfitVariantsAgent(
        decoded as unknown as Parameters<typeof runOutfitVariantsAgent>[0],
      );
    case "plan":
      return runPlannerAgent(decoded as unknown as Parameters<typeof runPlannerAgent>[0]);
    case "product-research":
      return researchProduct(
        requiredString(decoded, "userId"),
        decoded.clues as ProductResearchClues,
      );
    case "select-outfit":
      return runStylistAgent(decoded as unknown as Parameters<typeof runStylistAgent>[0]);
    case "explain-outfit":
      return explainWardrobeCandidate(
        decoded as unknown as Parameters<typeof explainWardrobeCandidate>[0],
      );
    case "extract-garment":
      return extractGarment(decoded as unknown as Parameters<typeof extractGarment>[0]);
    case "modeled-preview":
      return generateModeledPreview(
        decoded as unknown as Parameters<typeof generateModeledPreview>[0],
      );
    case "visualization-generate":
      return resolveVisualizationProvider().generate(
        decoded as unknown as Parameters<
          ReturnType<typeof resolveVisualizationProvider>["generate"]
        >[0],
      );
    case "visualization-assess":
      return resolveVisualizationProvider().assess(
        decoded as unknown as Parameters<
          ReturnType<typeof resolveVisualizationProvider>["assess"]
        >[0],
      );
    case "visualization-localize":
      return resolveVisualizationProvider().localize(
        decoded as unknown as Parameters<
          ReturnType<typeof resolveVisualizationProvider>["localize"]
        >[0],
      );
    case "identity-assess":
      return resolveVisualizationProvider().assessIdentity(
        decoded as unknown as Parameters<
          ReturnType<typeof resolveVisualizationProvider>["assessIdentity"]
        >[0],
      );
  }
}
