import { Trash } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { requestJson } from "@/lib/api/request";

export function ItemDeleteButton({
  itemId,
  itemName,
  action,
  onDone,
}: {
  itemId: string;
  itemName: string;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDone: () => void;
}) {
  return (
    <Button
      variant="danger"
      onClick={() => {
        if (!window.confirm(`Permanently delete ${itemName} and its images?`)) return;
        void action("delete", async () => {
          await requestJson(`/api/items/${itemId}`, { method: "DELETE" });
          onDone();
        });
      }}
    >
      <Trash size={15} /> Delete piece
    </Button>
  );
}
