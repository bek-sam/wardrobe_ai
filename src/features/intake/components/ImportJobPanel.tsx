import { CandidateSection } from "./CandidateSection";
import { ImportJobStatusCards } from "./ImportJobStatusCards";
import { ImportProgressCard } from "./ImportProgressCard";
import type { ImportJobPanelProps } from "./import-workspace.types";
import { OriginalImageReview } from "./OriginalImageReview";

export function ImportJobPanel({
  job,
  busyAction,
  activelyProcessing,
  dirtyCandidates,
  setDirtyCandidates,
  canConfirm,
  onConfirm,
  onApproveCrop,
  onApproveCutout,
  onReject,
  onRegenerate,
  onSaveMetadata,
  onStartAnother,
  onStartNew,
}: ImportJobPanelProps) {
  return (
    <>
      <ImportProgressCard activelyProcessing={activelyProcessing} job={job} />
      {job.originalImageUrl && <OriginalImageReview originalImageUrl={job.originalImageUrl} />}
      {job.candidates.length ? (
        <CandidateSection
          busyAction={busyAction}
          candidates={job.candidates}
          onApproveCrop={onApproveCrop}
          onApproveCutout={onApproveCutout}
          onReject={onReject}
          onRegenerate={onRegenerate}
          onSaveMetadata={onSaveMetadata}
          setDirtyCandidates={setDirtyCandidates}
        />
      ) : null}
      <ImportJobStatusCards
        busyAction={busyAction}
        canConfirm={canConfirm}
        dirtyCount={dirtyCandidates.size}
        job={job}
        onConfirm={onConfirm}
        onStartAnother={onStartAnother}
        onStartNew={onStartNew}
      />
    </>
  );
}
