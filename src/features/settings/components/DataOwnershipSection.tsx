import { GearSix } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

import { DataOwnershipActions } from "./DataOwnershipActions";
import { DeleteConfirmation } from "./DeleteConfirmation";
import type { DataOwnershipSectionProps } from "./settings.types";

export function DataOwnershipSection(props: DataOwnershipSectionProps) {
  const { disabled, busy, onExport, deleteOpen, onOpenDelete } = props;

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
          hasPassword={props.hasPassword}
          onCancel={props.onCancelDelete}
          onConfirm={props.onConfirmDelete}
          onPassword={props.onDeletePassword}
          onPhrase={props.onDeletePhrase}
          onReauthenticate={props.onReauthenticate}
          password={props.deletePassword}
          phrase={props.deletePhrase}
        />
      ) : null}
    </Card>
  );
}
