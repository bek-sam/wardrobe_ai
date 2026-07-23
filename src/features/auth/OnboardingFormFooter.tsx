import { ArrowRight, SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function OnboardingFormFooter({
  message,
  disabled,
  saving,
}: {
  message: string | null;
  disabled: boolean;
  saving: boolean;
}) {
  return (
    <>
      {message ? (
        <div className="form-section">
          <div className="inline-feedback inline-feedback--error" role="alert">
            <WarningCircle size={17} />
            <span>{message}</span>
          </div>
        </div>
      ) : null}
      <div className="onboarding-form__actions">
        <p>By continuing, you can review these choices anytime in Settings.</p>
        <Button disabled={disabled} type="submit">
          {saving ? <SpinnerGap className="spin" size={16} /> : null}
          {saving ? "Saving…" : "Save and add my first piece"}
          {!saving ? <ArrowRight size={16} /> : null}
        </Button>
      </div>
    </>
  );
}
