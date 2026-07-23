import { Button } from "@/components/ui/Button";
import { requestJson } from "@/lib/api/request";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { ItemEditFields } from "./ItemEditFields";
import type { ItemDetail, ItemEditValues } from "./item-detail.types";

export function ItemEditForm({
  item,
  setItem,
  editValues,
  setEditValues,
  busy,
  action,
  onSaved,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  editValues: ItemEditValues;
  setEditValues: (updater: (current: ItemEditValues) => ItemEditValues) => void;
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onSaved: () => void;
}) {
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action("edit", async () => {
      const saved = await requestJson<WardrobeItem>(`/api/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editValues.name,
          brand: editValues.brand || null,
          category: editValues.category,
          notes: editValues.notes,
        }),
      });
      setItem((current) => (current ? { ...current, ...saved } : current));
      onSaved();
    });
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <ItemEditFields editValues={editValues} setEditValues={setEditValues} />
      <Button disabled={busy === "edit"} type="submit">
        Save details
      </Button>
    </form>
  );
}
