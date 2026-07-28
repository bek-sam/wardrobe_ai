import { Check, SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import { useSavePlan } from "./use-save-plan";

/**
 * The explicit save affordance for a chat plan. Kept as its own component so
 * the generic message renderer stays presentational and never owns API or
 * request state.
 */
export function PlanAnswerActions({
  generationId,
  initiallySaved,
}: {
  generationId: string;
  initiallySaved: boolean;
}) {
  const { saved, saving, error, save } = useSavePlan(generationId, initiallySaved);

  if (saved) {
    return (
      <p className="chat-message__action" role="status">
        <Check size={15} /> <span>Plan saved</span>
      </p>
    );
  }

  return (
    <div className="chat-message__action">
      <Button disabled={saving} onClick={() => void save()} variant="ghost">
        {saving ? <SpinnerGap className="spin" size={15} /> : null}
        {saving ? "Saving plan…" : "Save plan"}
      </Button>
      {error ? (
        <span className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={15} /> {error}
        </span>
      ) : null}
    </div>
  );
}
