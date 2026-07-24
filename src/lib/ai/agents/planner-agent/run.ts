import { zodTextFormat } from "openai/helpers/zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { plannerResultSchema } from "@/lib/ai/schemas/stylist";
import { requireEnvironment } from "@/lib/env/server";

import { buildPlannerCandidateSummary } from "./candidate-summary";
import { PLANNER_AGENT_INSTRUCTIONS } from "./prompt.data";
import type { RunPlannerAgentInput } from "./types";
import { validatePlannerResult } from "./validate-plan";

export async function runPlannerAgent(input: RunPlannerAgentInput) {
  const environment = requireEnvironment("OPENAI_PLANNER_MODEL");
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: environment.OPENAI_PLANNER_MODEL,
    instructions: PLANNER_AGENT_INSTRUCTIONS,
    input: JSON.stringify({
      days: input.days,
      preferences: input.preferences,
      candidates: input.candidates.map(buildPlannerCandidateSummary),
    }),
    text: { format: zodTextFormat(plannerResultSchema, "wardrobe_week_plan") },
    safety_identifier: input.userId,
    store: false,
  });
  if (!response.output_parsed) throw new Error("The planner did not return a valid plan.");

  validatePlannerResult(response.output_parsed, input.days, input.candidates);
  return { result: response.output_parsed, responseId: response.id, usage: response.usage };
}
