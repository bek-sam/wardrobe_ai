import { X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export function ImportWorkspaceHeader({
  showCancel,
  cancelBusy,
  onCancel,
}: {
  showCancel: boolean;
  cancelBusy: boolean;
  onCancel: () => void;
}) {
  return (
    <PageHeader
      actions={
        showCancel ? (
          <Button disabled={cancelBusy} onClick={onCancel} variant="ghost">
            <X size={15} /> Cancel import
          </Button>
        ) : undefined
      }
      description="One garment or a full outfit works. Nothing is saved until you approve it."
      eyebrow="Add clothes"
      title="Import by photo"
    />
  );
}
