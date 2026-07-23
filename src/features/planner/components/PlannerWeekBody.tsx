import { PlannerEmptyState } from "./PlannerEmptyState";
import { plansByDateMap } from "./planner-stats";
import { PlannerWeekGrid } from "./PlannerWeekGrid";
import { PlannerWeekSkeleton } from "./PlannerWeekSkeleton";
import type { PlanView } from "./planner.types";
import type { usePlannerWorkspaceState } from "./use-planner-workspace-state";

export function PlannerWeekBody({
  state,
  onEdit,
}: {
  state: ReturnType<typeof usePlannerWorkspaceState>;
  onEdit: (date: string, plan: PlanView | null) => void;
}) {
  const plansByDate = plansByDateMap(state.dates, state.plans);
  if (state.loading) return <PlannerWeekSkeleton />;
  return (
    <>
      <PlannerWeekGrid
        dates={state.dates}
        forecast={state.forecast}
        onEdit={onEdit}
        plansByDate={plansByDate}
        profile={state.profile}
        today={state.today}
      />
      {!state.plans.length ? <PlannerEmptyState /> : null}
    </>
  );
}
