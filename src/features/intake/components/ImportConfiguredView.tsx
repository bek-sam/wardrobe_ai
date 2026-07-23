import { ImportErrorBanner } from "./ImportErrorBanner";
import { ImportJobOrUpload } from "./ImportJobOrUpload";
import { ImportSteps } from "./ImportSteps";
import { ImportTipCard } from "./ImportTipCard";
import type { useImportWorkspaceState } from "./use-import-workspace-state";

export function ImportConfiguredView({
  state,
}: {
  state: ReturnType<typeof useImportWorkspaceState>;
}) {
  const { fields, derived, startProcessing } = state;
  const showResume =
    Boolean(fields.job) &&
    (["queued", "analyzing", "extracting", "failed"].includes(fields.job!.status) ||
      fields.job!.candidates.some((candidate) => candidate.status === "extracting"));
  return (
    <>
      <ImportSteps current={derived.currentStep} />
      {fields.error ? (
        <ImportErrorBanner
          error={fields.error}
          onResume={() => startProcessing(fields.job!.id)}
          showResume={showResume}
        />
      ) : null}
      <ImportJobOrUpload state={state} />
      <ImportTipCard />
    </>
  );
}
