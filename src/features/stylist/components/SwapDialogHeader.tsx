import { X } from "@phosphor-icons/react";

export function SwapDialogHeader({ role, onClose }: { role: string; onClose: () => void }) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">Same-role replacement</p>
        <h2 id="swap-title">Swap {role}</h2>
      </div>
      <button
        aria-label="Close swap dialog"
        className="icon-button"
        onClick={onClose}
        type="button"
      >
        <X size={18} />
      </button>
    </div>
  );
}
