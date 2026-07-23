import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

import { titleCase } from "./import-text-helpers";
import type { ImportJobView } from "./import-workspace.types";

export function ImportProgressCard({
  job,
  activelyProcessing,
}: {
  job: ImportJobView;
  activelyProcessing: boolean;
}) {
  return (
    <Card className="import-progress-card">
      <div className="import-progress-card__copy">
        <div>
          <p className="eyebrow">Private import</p>
          <h2>{job.status === "complete" ? "Garments saved" : titleCase(job.status)}</h2>
        </div>
        <strong>{job.progress}%</strong>
      </div>
      <div
        aria-label={`Import progress: ${job.progress}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={job.progress}
        className="import-progress-track"
        role="progressbar"
      >
        <span style={{ width: `${job.progress}%` }} />
      </div>
      {activelyProcessing ? (
        <p className="import-progress-card__status" role="status">
          <SpinnerGap className="spin" size={16} /> AI processing may take a few minutes. You can
          return to this page without losing the job.
        </p>
      ) : null}
      {job.errorMessage ? (
        <p className="inline-feedback inline-feedback--error">
          <WarningCircle size={16} /> {job.errorMessage}
        </p>
      ) : null}
    </Card>
  );
}
