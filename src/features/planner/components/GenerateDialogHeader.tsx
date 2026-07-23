import { X } from "@phosphor-icons/react";

export function GenerateDialogHeader({
  disabled,
  onClose,
}: {
  disabled: boolean;
  onClose: () => void;
}) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">Owned items only</p>
        <h2 id="generate-week-title">Plan selected days</h2>
      </div>
      <button
        aria-label="Close generator"
        className="icon-button"
        disabled={disabled}
        onClick={onClose}
        type="button"
      >
        <X size={18} />
      </button>
    </div>
  );
}
