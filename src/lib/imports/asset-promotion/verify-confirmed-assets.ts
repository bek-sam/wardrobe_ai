import { sameStringSet } from "./same-string-set";
import type { ConfirmedCandidate, ImageRow, ImportJob } from "./schemas";

export function verifyConfirmedAssets(input: {
  itemIds: string[];
  candidates: ConfirmedCandidate[];
  ownedItems: { id: string }[];
  imageRows: ImageRow[];
  job: ImportJob;
}) {
  const { itemIds, candidates, ownedItems, imageRows, job } = input;

  if (
    !sameStringSet(
      itemIds,
      candidates.map((candidate) => candidate.wardrobe_item_id),
    )
  ) {
    throw new Error("Confirmed candidates do not match the returned item IDs.");
  }
  if (
    !sameStringSet(
      itemIds,
      ownedItems.map((item) => item.id),
    )
  ) {
    throw new Error("One or more confirmed items do not belong to the authenticated user.");
  }

  for (const itemId of itemIds) {
    const originalRows = imageRows.filter(
      (row) =>
        row.item_id === itemId &&
        row.kind === "original" &&
        row.bucket_id === job.original_image_bucket &&
        row.storage_path === job.original_image_path,
    );
    if (originalRows.length !== 1) {
      throw new Error(`The shared original-image lineage is missing for item ${itemId}.`);
    }
  }
}
