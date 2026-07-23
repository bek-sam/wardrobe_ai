import { DownloadSimple, Trash } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function DataOwnershipActions({
  disabled,
  busy,
  onExport,
  onDelete,
}: {
  disabled: boolean;
  busy: string | null;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="data-action">
        <span>
          <DownloadSimple size={20} />
        </span>
        <div>
          <strong>Export your data</strong>
          <p>Download wardrobe metadata, preferences, outfits, plans, and image references.</p>
        </div>
        <Button disabled={disabled} onClick={onExport} variant="secondary">
          {busy === "export" ? "Preparing…" : "Request export"}
        </Button>
      </div>
      <div className="data-action data-action--danger">
        <span>
          <Trash size={20} />
        </span>
        <div>
          <strong>Delete account</strong>
          <p>Permanently remove account rows and associated private files.</p>
        </div>
        <Button disabled={disabled} onClick={onDelete} variant="danger">
          Delete account
        </Button>
      </div>
    </>
  );
}
