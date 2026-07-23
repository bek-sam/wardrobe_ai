import type { ImageRow } from "./schemas";
import type { ImportAssetPromotionPlan } from "./types";

export function resolveImageRow(plan: ImportAssetPromotionPlan, imageRows: ImageRow[]) {
  const matches = imageRows.filter(
    (row) =>
      row.item_id === plan.itemId &&
      row.kind === plan.kind &&
      (row.storage_path === plan.source.path || row.storage_path === plan.destination.path),
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one ${plan.kind} image row for confirmed item ${plan.itemId}.`);
  }
  return matches[0]!;
}
