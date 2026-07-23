import { ArrowRight, Check, Heart, SpinnerGap } from "@phosphor-icons/react";

import { Button, ButtonLink } from "@/components/ui/Button";

export function TodayLookActions({
  saved,
  saving,
  notice,
  onSave,
}: {
  saved: boolean;
  saving: boolean;
  notice: string | null;
  onSave: () => void;
}) {
  return (
    <>
      <div className="today-look__actions">
        <Button disabled={saved || saving} onClick={onSave}>
          {saving ? (
            <SpinnerGap className="spin" size={16} aria-hidden="true" />
          ) : saved ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Heart size={16} aria-hidden="true" />
          )}
          {saved ? "Saved" : "Save look"}
        </Button>
        <ButtonLink href="/outfits" variant="secondary">
          View outfits <ArrowRight size={15} aria-hidden="true" />
        </ButtonLink>
      </div>
      {notice ? (
        <div className="inline-feedback inline-feedback--success today-look__notice" role="status">
          <Check size={16} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}
    </>
  );
}
