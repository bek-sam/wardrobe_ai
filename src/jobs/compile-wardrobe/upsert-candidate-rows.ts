import type { GeneratedOutfitCandidate } from "@/lib/compilation/generate-outfit-candidates";

import type { AdminClient, ReusableCandidateFields } from "./types";

export async function upsertCandidateRows(
  admin: AdminClient,
  userId: string,
  jobId: string,
  compiledWardrobeVersion: string,
  candidates: readonly GeneratedOutfitCandidate[],
  reusableByCombinationKey: ReadonlyMap<string, ReusableCandidateFields>,
): Promise<Map<string, string>> {
  const { data: upsertedCandidates, error } = await admin
    .from("outfit_candidates")
    .upsert(
      candidates.map((candidate) => ({
        user_id: userId,
        combination_key: candidate.combinationKey,
        compiled_wardrobe_version: compiledWardrobeVersion,
        job_id: jobId,
        occasion_tags: candidate.occasionTags,
        occasion_category: candidate.occasionCategory,
        weather_tags: candidate.weatherTags,
        formality_level: candidate.formalityLevel,
        warmth_level: candidate.warmthLevel,
        color_harmony: candidate.colorHarmony,
        layering_quality: candidate.layeringQuality,
        occasion_formality: candidate.occasionFormality,
        preference_match: candidate.preferenceMatch,
        variety: candidate.variety,
        total_score: candidate.totalScore,
        ...reusableByCombinationKey.get(candidate.combinationKey),
      })),
      { onConflict: "user_id,compiled_wardrobe_version,combination_key" },
    )
    .select("id, combination_key");
  if (error) throw error;

  return new Map(
    (upsertedCandidates ?? []).map((row) => [row.combination_key as string, row.id as string]),
  );
}
