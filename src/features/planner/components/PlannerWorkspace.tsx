"use client";

import { plansByDateMap, countLooks, countOpenDays, countRainyDays } from "./planner-stats";
import { PlannerDialogs } from "./PlannerDialogs";
import { PlannerSummary } from "./PlannerSummary";
import { PlannerTopSection } from "./PlannerTopSection";
import { PlannerWeekBody } from "./PlannerWeekBody";
import { PreviewPlanner } from "./PreviewPlanner";
import { usePlannerWorkspaceState } from "./use-planner-workspace-state";

export function PlannerWorkspace({
  supabaseConfigured,
  aiConfigured,
  initialDate,
}: {
  supabaseConfigured: boolean;
  aiConfigured: boolean;
  initialDate: string;
}) {
  const state = usePlannerWorkspaceState(initialDate, supabaseConfigured);

  if (!supabaseConfigured) return <PreviewPlanner />;

  const plansByDate = plansByDateMap(state.dates, state.plans);
  const openDays = countOpenDays(state.dates, plansByDate);

  return (
    <>
      <PlannerTopSection aiConfigured={aiConfigured} state={state} />
      <PlannerWeekBody onEdit={(date, plan) => state.setEditor({ date, plan })} state={state} />
      <PlannerSummary
        aiConfigured={aiConfigured}
        lookCount={countLooks(state.plans)}
        onFillOpenDays={() => state.setGeneratorOpen(true)}
        openDays={openDays}
        planCount={state.plans.length}
        rainyDays={countRainyDays(state.dates, state.forecast)}
      />
      <PlannerDialogs state={state} />
    </>
  );
}
