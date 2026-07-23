import { shiftDate } from "./planner-dates";
import { PlannerHeader } from "./PlannerHeader";
import { PlannerNotices } from "./PlannerNotices";
import { PlannerToolbar } from "./PlannerToolbar";
import type { usePlannerWorkspaceState } from "./use-planner-workspace-state";

export function PlannerTopSection({
  state,
  aiConfigured,
}: {
  state: ReturnType<typeof usePlannerWorkspaceState>;
  aiConfigured: boolean;
}) {
  return (
    <>
      <PlannerHeader
        aiConfigured={aiConfigured}
        canAddOccasion={Boolean(state.dates.length)}
        canGenerate={aiConfigured && Boolean(state.dates.length) && !state.loading}
        onAddOccasion={() =>
          state.dates[0] && state.setEditor({ date: state.dates[0], plan: null })
        }
        onGenerate={() => state.setGeneratorOpen(true)}
      />
      <PlannerNotices
        aiConfigured={aiConfigured}
        error={state.error}
        notice={state.notice}
        onDismissNotice={() => state.setNotice(null)}
        onRetry={() => state.setRefresh((value) => value + 1)}
      />
      <PlannerToolbar
        anchor={state.anchor}
        dates={state.dates}
        loading={state.loading}
        onShift={(days) => state.setAnchor((current) => shiftDate(current, days))}
        onToday={() => state.setAnchor(state.today)}
        profile={state.profile}
        today={state.today}
      />
    </>
  );
}
