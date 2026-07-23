import { GenerateDialog } from "./GenerateDialog";
import { PlanEditor } from "./PlanEditor";
import type { usePlannerWorkspaceState } from "./use-planner-workspace-state";

export function PlannerDialogs({ state }: { state: ReturnType<typeof usePlannerWorkspaceState> }) {
  return (
    <>
      {state.editor ? (
        <PlanEditor
          date={state.editor.date}
          onClose={() => state.setEditor(null)}
          onDeleted={() => {
            state.setEditor(null);
            state.setNotice("Plan deleted.");
            state.setRefresh((value) => value + 1);
          }}
          onSaved={() => {
            state.setEditor(null);
            state.setNotice("Plan saved.");
            state.setRefresh((value) => value + 1);
          }}
          outfits={state.outfits}
          plan={state.editor.plan}
        />
      ) : null}
      {state.generatorOpen ? (
        <GenerateDialog
          dates={state.dates}
          onClose={() => state.setGeneratorOpen(false)}
          onGenerated={(message) => {
            state.setGeneratorOpen(false);
            state.setNotice(message);
            state.setRefresh((value) => value + 1);
          }}
          plans={state.plans}
        />
      ) : null}
    </>
  );
}
