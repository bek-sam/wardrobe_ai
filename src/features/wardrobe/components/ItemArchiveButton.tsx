import { Button } from "@/components/ui/Button";
import { requestJson } from "@/lib/api/request";

export function ItemArchiveButton({
  itemId,
  action,
  onDone,
}: {
  itemId: string;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDone: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() =>
        void action("archive", async () => {
          await requestJson(`/api/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "archived" }),
          });
          onDone();
        })
      }
    >
      Archive
    </Button>
  );
}
