import type { OutfitSelections } from "./outfits-manager.types";

export function buildManualOutfitPayload(form: {
  name: string;
  occasion: string;
  explanation: string;
  favorite: boolean;
  selectedEntries: Array<{ role: keyof OutfitSelections; item: { id: string } }>;
}) {
  return {
    name: form.name.trim(),
    occasion: form.occasion.trim() || null,
    explanation: form.explanation.trim() || null,
    favorite: form.favorite,
    items: form.selectedEntries.map((entry, index) => ({
      item_id: entry.item.id,
      role: entry.role,
      sort_order: index,
    })),
  };
}
