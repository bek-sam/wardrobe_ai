import { runAiTask } from "@/lib/ai/client";

type ModelIntentScore = {
  intent: "outfit_request" | "planning" | "packing" | "insight" | "item_question";
  confidence: number;
};

export function canClassifyWardrobeIntentWithModel() {
  return Boolean(process.env.AI_ORCHESTRATION_URL && process.env.AI_SERVICE_TOKEN);
}

export async function classifyWardrobeIntentWithModel(
  request: string,
  userId: string,
): Promise<ModelIntentScore | null> {
  if (!canClassifyWardrobeIntentWithModel()) return null;
  try {
    return await runAiTask("classify-intent", { request: request.slice(0, 2_000), userId }, 15_000);
  } catch {
    return null;
  }
}
