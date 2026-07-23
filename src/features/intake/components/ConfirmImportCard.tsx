import { Check, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function ConfirmImportCard({
  canConfirm,
  busy,
  dirtyCount,
  onConfirm,
}: {
  canConfirm: boolean;
  busy: boolean;
  dirtyCount: number;
  onConfirm: () => void;
}) {
  return (
    <Card className="confirm-import-card">
      <div>
        <p className="eyebrow">Final check</p>
        <h2>Add reviewed garments to your wardrobe</h2>
        <p>
          Save any edited detail cards first. Only these detected, approved pieces will be created.
        </p>
        {dirtyCount ? <small>{dirtyCount} card has unsaved changes.</small> : null}
      </div>
      <Button disabled={!canConfirm} onClick={onConfirm}>
        {busy ? <SpinnerGap className="spin" size={16} /> : <Check size={16} />}
        Confirm &amp; save
      </Button>
    </Card>
  );
}
