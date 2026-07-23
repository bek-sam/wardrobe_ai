import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function ItemFormFooter({
  error,
  saving,
  editing,
  canSubmit,
  onClose,
}: {
  error: string | null;
  saving: boolean;
  editing: boolean;
  canSubmit: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {error ? (
        <p className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      ) : null}
      <div className="item-form-dialog__actions">
        <Button onClick={onClose} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving || !canSubmit} type="submit">
          {saving ? <SpinnerGap className="spin" size={16} /> : null}
          {editing ? "Save changes" : "Add to wardrobe"}
        </Button>
      </div>
    </>
  );
}
