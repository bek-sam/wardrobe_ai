type FeedbackRow = { outfit_id: string; feedback_type: string };
type OutfitItemRow = { outfit_id: string; item_id: string };

function repeatedIds(evidence: Map<string, number>) {
  return [...evidence].filter(([, count]) => count >= 2).map(([itemId]) => itemId);
}

export function buildFeedbackEvidence(
  feedbackRows: readonly FeedbackRow[],
  outfitItems: readonly OutfitItemRow[],
) {
  const itemIdsByOutfit = new Map<string, string[]>();
  for (const row of outfitItems) {
    const itemIds = itemIdsByOutfit.get(row.outfit_id) ?? [];
    itemIds.push(row.item_id);
    itemIdsByOutfit.set(row.outfit_id, itemIds);
  }

  const likedEvidence = new Map<string, number>();
  const dislikedEvidence = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  for (const row of feedbackRows) {
    reasonCounts.set(row.feedback_type, (reasonCounts.get(row.feedback_type) ?? 0) + 1);
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

  return {
    likedItemIds: repeatedIds(likedEvidence),
    dislikedItemIds: repeatedIds(dislikedEvidence),
    reasonCounts: Object.fromEntries(reasonCounts),
  };
}
