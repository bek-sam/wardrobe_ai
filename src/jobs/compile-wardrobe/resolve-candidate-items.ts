import type { WardrobeItem } from "@/features/wardrobe/types";

import type { CuratorCandidateRow } from "./types";

export function resolveCandidateItems(
  row: CuratorCandidateRow,
  itemsById: ReadonlyMap<string, WardrobeItem>,
): WardrobeItem[] | null {
  const memberRows = row.outfit_candidate_items ?? [];
  const resolved = memberRows.map((member) => itemsById.get(member.item_id));
  if (resolved.some((item) => item === undefined)) return null;
  return resolved as WardrobeItem[];
}
