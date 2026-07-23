import { ImportIdleContent } from "./ImportIdleContent";
import { ImportJobContent } from "./ImportJobContent";
import type { useImportWorkspaceState } from "./use-import-workspace-state";

export function ImportJobOrUpload({
  state,
}: {
  state: ReturnType<typeof useImportWorkspaceState>;
}) {
  return state.fields.job ? (
    <ImportJobContent job={state.fields.job} state={state} />
  ) : (
    <ImportIdleContent state={state} />
  );
}
