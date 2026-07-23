"use client";

import { ImportConfiguredView } from "./ImportConfiguredView";
import { ImportWorkspaceHeader } from "./ImportWorkspaceHeader";
import { PreviewImport } from "./PreviewImport";
import { useImportWorkspaceState } from "./use-import-workspace-state";

export function ImportWorkspace({ configured }: { configured: boolean }) {
  const state = useImportWorkspaceState(configured);
  const { fields, cancelImport } = state;

  return (
    <div className="page-stack import-page">
      <ImportWorkspaceHeader
        cancelBusy={fields.busyAction === "cancel"}
        onCancel={() => void cancelImport()}
        showCancel={Boolean(fields.job && !["complete", "cancelled"].includes(fields.job.status))}
      />
      {configured ? <ImportConfiguredView state={state} /> : <PreviewImport />}
    </div>
  );
}
