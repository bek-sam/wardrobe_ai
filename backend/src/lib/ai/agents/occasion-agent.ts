import { runAiTask } from "@/lib/ai/client";
import { resolveOccasionContext, type OccasionContext } from "@/lib/recommendation";

export async function resolveOccasionContextWithEscalation(
  rawText: string | null | undefined,
  userId: string,
): Promise<OccasionContext> {
  const deterministic = resolveOccasionContext(rawText);
  if (!rawText?.trim() || deterministic.confidence >= 0.5) return deterministic;
  try {
    return await runAiTask("occasion", { rawText, userId }, 20_000);
  } catch {
    return deterministic;
  }
}
