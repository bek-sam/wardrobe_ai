import { Check, WarningCircle, X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";

export function PlannerNotices({
  aiConfigured,
  error,
  onRetry,
  notice,
  onDismissNotice,
}: {
  aiConfigured: boolean;
  error: string | null;
  onRetry: () => void;
  notice: string | null;
  onDismissNotice: () => void;
}) {
  return (
    <>
      {!aiConfigured ? (
        <DemoNotice>
          Your saved plans remain live and editable, but the OpenAI planner model is not configured.
          Week generation is disabled and no sample looks are shown as account data.
        </DemoNotice>
      ) : null}
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} /> <span>{error}</span>
          <Button onClick={onRetry} variant="ghost">
            Try again
          </Button>
        </div>
      ) : null}
      {notice ? (
        <div className="inline-feedback inline-feedback--success" role="status">
          <Check size={16} /> <span>{notice}</span>
          <button
            aria-label="Dismiss message"
            className="icon-button icon-button--small"
            onClick={onDismissNotice}
            type="button"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
    </>
  );
}
