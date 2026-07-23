import type { ItemEditValues } from "./item-detail.types";

export function ItemEditFields({
  editValues,
  setEditValues,
}: {
  editValues: ItemEditValues;
  setEditValues: (updater: (current: ItemEditValues) => ItemEditValues) => void;
}) {
  return (
    <>
      <input
        aria-label="Item name"
        required
        value={editValues.name}
        onChange={(event) => setEditValues((value) => ({ ...value, name: event.target.value }))}
      />
      <input
        aria-label="Brand"
        placeholder="Brand (optional)"
        value={editValues.brand}
        onChange={(event) => setEditValues((value) => ({ ...value, brand: event.target.value }))}
      />
      <input
        aria-label="Category"
        required
        value={editValues.category}
        onChange={(event) => setEditValues((value) => ({ ...value, category: event.target.value }))}
      />
      <textarea
        aria-label="Notes"
        value={editValues.notes}
        onChange={(event) => setEditValues((value) => ({ ...value, notes: event.target.value }))}
      />
    </>
  );
}
