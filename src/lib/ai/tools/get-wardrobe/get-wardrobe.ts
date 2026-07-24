import { ApiError } from "@/lib/api/response";
import { filterWardrobeCandidates, rankWardrobeCandidates } from "@/lib/recommendation";
import { createClient } from "@/lib/supabase/server";

import { buildRoleShortlist } from "./build-shortlist";
import { parseWardrobeRow } from "./parse-wardrobe-row";
import type { GetWardrobeCandidatesInput } from "./types";

export async function getWardrobeCandidates(input: GetWardrobeCandidatesInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("availability_status", "available")
    .is("deleted_at", null)
    .limit(500);
  if (error) throw error;
  const items = (data ?? []).map((row) => parseWardrobeRow(row as Record<string, unknown>));
  const filtered = filterWardrobeCandidates(items, {
    weather: input.weather,
    requiredOccasionTags: input.occasionTags,
  });
  const scores = rankWardrobeCandidates(filtered.eligible, {
    weather: input.weather,
    occasionTags: input.occasionTags,
    targetFormality: input.targetFormality,
    preferences: {
      favoriteColors: input.favoriteColors,
      avoidedColors: input.avoidedColors,
      preferredFits: input.preferredFits,
      likedItemIds: input.likedItemIds,
      dislikedItemIds: input.dislikedItemIds,
    },
  });
  const scoreById = new Map(scores.map((score) => [score.itemId, score]));
  const shortlist = buildRoleShortlist(filtered.eligible, scoreById);
  if (shortlist.length === 0) {
    throw new ApiError(422, "no_eligible_items", "No available wardrobe items match this request.");
  }

  return {
    items: shortlist,
    scores: scoreById,
    excluded: filtered.excluded.map(({ item, reasons }) => ({ itemId: item.id, reasons })),
  };
}
