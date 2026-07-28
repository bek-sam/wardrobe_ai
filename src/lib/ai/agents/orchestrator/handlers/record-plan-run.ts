import type { IntentDateRange, WardrobeIntent } from "../intent";
import { recordWardrobeOrchestratorRun } from "../record-agent-run";
import { buildRecordedPlans } from "./recorded-plans";
import type { runPlanForWindow } from "./run-plan";

type RecordPlanRunInput = {
  userId: string;
  intent: WardrobeIntent;
  window: IntentDateRange;
  plan: Awaited<ReturnType<typeof runPlanForWindow>>;
  startedAt: number;
  destination?: string | null;
};

/** Safe summary only: dates, item ids, and planner metadata -- no prompts. */
export function recordPlanRun({
  userId,
  intent,
  window,
  plan,
  startedAt,
  destination,
}: RecordPlanRunInput) {
  return recordWardrobeOrchestratorRun({
    userId,
    inputSummary: {
      intent,
      source: "planner",
      startDate: window.startDate,
      endDate: window.endDate,
      dayCount: window.dayCount,
      destination: destination ?? null,
    },
    outputSummary: {
      dates: plan.views.map((view) => view.date),
      itemIds: plan.views.flatMap((view) => view.items.map((item) => item.item_id)),
      responseId: plan.responseId,
      missingCategories: plan.missingCategories,
      // Only a planning run is saveable, so only a planning run records the
      // replayable representation. A packing list stays advisory in this
      // iteration and deliberately carries nothing the save RPC could act on.
      ...(intent === "planning" ? { plans: buildRecordedPlans(plan.views) } : {}),
    },
    model: plan.model,
    latencyMs: Date.now() - startedAt,
    usage: plan.usage,
  });
}
