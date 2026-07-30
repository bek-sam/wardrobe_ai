"use client";

import { Button } from "@/components/ui/Button";

import { compilationHeadline } from "./compilation-headline";
import { formatLastCompiled } from "./format-last-compiled";
import { useCompilationStatus } from "./use-compilation-status";

export function CompilationStatus({ configured }: { configured: boolean }) {
  const { status, recompiling, notice, recompileNow } = useCompilationStatus(configured);
  if (!configured) return null;

  const jobStatus = status?.latest_job_status ?? null;
  // A queued job is pending, not in flight. Treating it as running disabled the
  // one control that can drain it and reported "Recompiling…" for a job nothing
  // was working on -- so a queue with no worker looked like perpetual progress.
  const isRunning = recompiling || jobStatus === "running";
  const isFailed = !isRunning && jobStatus === "failed";

  return (
    <div className="wardrobe-compile-status" aria-live="polite">
      <div className="wardrobe-compile-status-text">
        <span>{compilationHeadline(status, isRunning, isFailed)}</span>
        <span className="wardrobe-compile-status-meta">
          Last compiled: {formatLastCompiled(status?.last_compiled_at ?? null)}
        </span>
        {notice ? <span className="wardrobe-compile-status-notice">{notice}</span> : null}
      </div>
      <Button
        aria-label={isFailed ? "Retry compiling your outfit library" : "Recompile outfit library"}
        disabled={isRunning}
        onClick={() => void recompileNow()}
        variant="ghost"
      >
        {isFailed ? "Retry" : "Recompile"}
      </Button>
    </div>
  );
}
