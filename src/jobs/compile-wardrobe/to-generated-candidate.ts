import type { GeneratedOutfitCandidate } from "@/lib/compilation/generate-outfit-candidates";

import type { CuratorCandidateRow } from "./types";

export function toGeneratedCandidate(row: CuratorCandidateRow): GeneratedOutfitCandidate {
  const memberRows = row.outfit_candidate_items ?? [];
  return {
    combinationKey: row.combination_key,
    items: memberRows.map((member, index) => ({
      itemId: member.item_id,
      role: member.role,
      sortOrder: index,
    })),
    totalScore: row.total_score,
    colorHarmony: row.color_harmony ?? 0,
    layeringQuality: row.layering_quality ?? 0,
    occasionFormality: row.occasion_formality ?? 0,
    preferenceMatch: row.preference_match ?? 0,
    variety: row.variety ?? 0,
    occasionTags: [],
    occasionCategory: (row.occasion_category ??
      "casual") as GeneratedOutfitCandidate["occasionCategory"],
    weatherTags: row.weather_tags ?? [],
    formalityLevel: row.formality_level,
    warmthLevel: row.warmth_level,
    bucketKey: row.occasion_category ?? "casual",
  };
}
