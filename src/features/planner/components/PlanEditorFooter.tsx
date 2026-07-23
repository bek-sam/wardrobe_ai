import { Check, SpinnerGap, Trash, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function PlanEditorFooter({
  editing,
  saving,
  error,
  onDelete,
  onCancel,
}: {
  editing: boolean;
  saving: boolean;
  error: string | null;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      {error ? (
        <p className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      ) : null}
      <div className="planner-dialog__actions">
        {editing ? (
          <Button disabled={saving} onClick={onDelete} type="button" variant="danger">
            <Trash size={15} /> Delete
          </Button>
        ) : null}
        <span />
        <Button disabled={saving} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
          Save plan
        </Button>
      </div>
    </>
  );
}
