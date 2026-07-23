import { X } from "@phosphor-icons/react";

export function PlanEditorHeader({
  editing,
  disabled,
  onClose,
}: {
  editing: boolean;
  disabled: boolean;
  onClose: () => void;
}) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">{editing ? "Update plan" : "Add context"}</p>
        <h2 id="plan-editor-title">{editing ? "Edit planned day" : "Plan a day"}</h2>
      </div>
      <button
        aria-label="Close plan editor"
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
