import type { CuratorCandidateRow } from "./types";

export function buildAffectedItemsShortlist(
  rows: readonly CuratorCandidateRow[],
  affectedItemIds: ReadonlySet<string>,
  maxCandidatesPerCall: number,
): CuratorCandidateRow[] {
  const containsAffectedItem = (row: CuratorCandidateRow) =>
    (row.outfit_candidate_items ?? []).some((member) => affectedItemIds.has(member.item_id));

  const perOccasionCount = new Map<string, number>();
  return rows
    .filter(containsAffectedItem)
    .filter((row) => {
      const key = row.occasion_category ?? "casual";
      const count = perOccasionCount.get(key) ?? 0;
      if (count >= 6) return false;
      perOccasionCount.set(key, count + 1);
      return true;
    })
    .slice(0, maxCandidatesPerCall);
}

export function buildCatchUpShortlist(
  rows: readonly CuratorCandidateRow[],
  usedIds: ReadonlySet<string>,
  maxCandidatesPerCall: number,
): CuratorCandidateRow[] {
  return [...rows]
    .filter((row) => row.curator_status === "not_reviewed" && !usedIds.has(row.id))
    .sort(
      (first, second) =>
        new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
    )
    .slice(0, maxCandidatesPerCall);
}
