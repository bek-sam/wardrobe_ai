import { SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function ManualOutfitFooter({
  saving,
  validationMessage,
  onCancel,
}: {
  saving: boolean;
  validationMessage: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="item-form-dialog__actions">
      <Button disabled={saving} onClick={onCancel} type="button" variant="ghost">
        Cancel
      </Button>
      <Button disabled={saving || validationMessage !== null} type="submit">
        {saving ? <SpinnerGap className="spin" size={16} /> : null}
        {saving ? "Saving…" : "Save outfit"}
      </Button>
    </div>
  );
}
