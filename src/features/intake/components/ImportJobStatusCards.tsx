import { ConfirmImportCard } from "./ConfirmImportCard";
import { ImportCancelledCard } from "./ImportCancelledCard";
import { ImportCompleteCard } from "./ImportCompleteCard";
import type { ImportJobView } from "./import-workspace.types";

export function ImportJobStatusCards({
  job,
  busyAction,
  canConfirm,
  dirtyCount,
  onConfirm,
  onStartAnother,
  onStartNew,
}: {
  job: ImportJobView;
  busyAction: string | null;
  canConfirm: boolean;
  dirtyCount: number;
  onConfirm: () => void;
  onStartAnother: () => void;
  onStartNew: () => void;
}) {
  if (job.status === "review_metadata") {
    return (
      <ConfirmImportCard
        busy={busyAction === "confirm"}
        canConfirm={canConfirm}
        dirtyCount={dirtyCount}
        onConfirm={onConfirm}
      />
    );
  }
  if (job.status === "complete") return <ImportCompleteCard onStartAnother={onStartAnother} />;
  if (job.status === "cancelled") return <ImportCancelledCard onStartNew={onStartNew} />;
  return null;
}
