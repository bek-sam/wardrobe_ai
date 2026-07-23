import { Heart, Sparkle, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function TodayContextFormActions({
  disabled,
  generating,
  onBuildAndSave,
}: {
  disabled: boolean;
  generating: "unsaved" | "saved" | null;
  onBuildAndSave: () => void;
}) {
  return (
    <div className="today-context-form__actions">
      <Button disabled={disabled} type="submit">
        {generating === "unsaved" ? (
          <SpinnerGap className="spin" size={16} aria-hidden="true" />
        ) : (
          <Sparkle size={16} aria-hidden="true" />
        )}
        Build today’s look
      </Button>
      <Button disabled={disabled} onClick={onBuildAndSave} variant="secondary">
        {generating === "saved" ? (
          <SpinnerGap className="spin" size={16} aria-hidden="true" />
        ) : (
          <Heart size={16} aria-hidden="true" />
        )}
        Build &amp; save
      </Button>
    </div>
  );
}
