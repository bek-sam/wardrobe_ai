import type { z } from "zod";

import type { stylistRequestSchema } from "@/features/stylist/schemas";
import type { StylistOrchestratorInput } from "@/lib/ai/agents/orchestrator";

type StylistRequestInput = z.infer<typeof stylistRequestSchema>;

/** Maps one validated chat request onto the orchestrator's input shape. */
export function toOrchestratorInput(
  userId: string,
  input: StylistRequestInput,
): StylistOrchestratorInput {
  return {
    userId,
    request: input.message,
    date: input.date,
    location: input.location,
    occasion: input.occasion,
    targetFormality: input.targetFormality,
    indoorOutdoor: input.indoorOutdoor,
  };
}
