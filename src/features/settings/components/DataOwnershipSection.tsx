import { GearSix } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

import { DataOwnershipActions } from "./DataOwnershipActions";
import { DeleteConfirmation } from "./DeleteConfirmation";
import type { DataOwnershipSectionProps } from "./settings.types";

export function DataOwnershipSection({
  disabled,
  busy,
  onExport,
  deleteOpen,
  onOpenDelete,
  deletePhrase,
  onDeletePhrase,
  deletePassword,
  onDeletePassword,
  onConfirmDelete,
  onCancelDelete,
}: DataOwnershipSectionProps) {
  return (
    <Card as="section" className="settings-section settings-section--data">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Data ownership</p>
          <h2>Export or delete</h2>
          <p>Download your data or permanently remove this account.</p>
        </div>
        <GearSix size={22} />
      </div>
      <DataOwnershipActions
        busy={busy}
        disabled={disabled}
        onDelete={onOpenDelete}
        onExport={onExport}
      />
      {deleteOpen ? (
        <DeleteConfirmation
          busy={busy === "delete"}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
          onPassword={onDeletePassword}
          onPhrase={onDeletePhrase}
          password={deletePassword}
          phrase={deletePhrase}
        />
      ) : null}
    </Card>
  );
}
