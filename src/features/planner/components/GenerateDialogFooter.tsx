import { Sparkle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function GenerateDialogFooter({
  generating,
  error,
  canSubmit,
  onCancel,
}: {
  generating: boolean;
  error: string | null;
  canSubmit: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      {generating ? (
        <p className="inline-feedback" role="status">
          <SpinnerGap className="spin" size={16} /> Building and validating each selected day…
        </p>
      ) : null}
      {error ? (
        <p className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      ) : null}
      <div className="planner-dialog__actions">
        <span />
        <span />
        <Button disabled={generating} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={generating || !canSubmit} type="submit">
          {generating ? <SpinnerGap className="spin" size={15} /> : <Sparkle size={15} />}
          Generate &amp; save
        </Button>
      </div>
    </>
  );
}
