type FeedbackRow = { outfit_id: string; feedback_type: string };
type OutfitItemRow = { outfit_id: string; item_id: string };

export function buildPreferenceEvidence(
  feedbackRows: readonly FeedbackRow[],
  outfitItems: readonly OutfitItemRow[],
) {
  const itemIdsByOutfit = new Map<string, string[]>();
  for (const row of outfitItems) {
    const ids = itemIdsByOutfit.get(row.outfit_id) ?? [];
    ids.push(row.item_id);
    itemIdsByOutfit.set(row.outfit_id, ids);
  }

  const likedEvidence = new Map<string, number>();
  const dislikedEvidence = new Map<string, number>();
  for (const row of feedbackRows) {
    const evidence =
      row.feedback_type === "like"
        ? likedEvidence
        : row.feedback_type === "dislike"
          ? dislikedEvidence
          : null;
    if (!evidence) continue;
    for (const itemId of itemIdsByOutfit.get(row.outfit_id) ?? []) {
      evidence.set(itemId, (evidence.get(itemId) ?? 0) + 1);
    }
  }
  const repeatedIds = (evidence: Map<string, number>) =>
    [...evidence].filter(([, count]) => count >= 2).map(([itemId]) => itemId);

  return {
    likedItemIds: repeatedIds(likedEvidence),
    dislikedItemIds: repeatedIds(dislikedEvidence),
  };
}
