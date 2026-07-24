import type { StylistResult } from "@/lib/ai/schemas/stylist";

export function validateOwnedSelection(result: StylistResult, candidateIds: ReadonlySet<string>) {
  const uniqueIds = new Set(result.itemIds);
  if (uniqueIds.size !== result.itemIds.length) {
    throw new Error("The stylist returned a duplicate wardrobe item.");
  }
  const invalidIds = result.itemIds.filter((id) => !candidateIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error("The stylist returned an item outside the authenticated candidate set.");
  }
}
