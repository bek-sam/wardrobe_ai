import { X } from "@phosphor-icons/react";

export function ManualOutfitDialogHeader({
  onClose,
  disabled,
}: {
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">Manual outfit</p>
        <h2 id="manual-outfit-title">Build from your wardrobe</h2>
      </div>
      <button
        aria-label="Close manual outfit builder"
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
