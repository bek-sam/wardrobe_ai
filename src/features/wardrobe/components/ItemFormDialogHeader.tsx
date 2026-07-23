import { X } from "@phosphor-icons/react";

export function ItemFormDialogHeader({
  editing,
  onClose,
}: {
  editing: boolean;
  onClose: () => void;
}) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">{editing ? "Edit piece" : "Manual entry"}</p>
        <h2 id="item-form-title">{editing ? "Update garment" : "Add a garment"}</h2>
      </div>
      <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
        <X size={18} />
      </button>
    </div>
  );
}
