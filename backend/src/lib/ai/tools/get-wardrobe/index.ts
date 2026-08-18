import type { ClothingConstraints } from "@/lib/weather";
import { ApiError } from "@/lib/api/response";
import { filterWardrobeCandidates, rankWardrobeCandidates } from "@/lib/recommendation";
import { createClient } from "@/lib/supabase/server";
import { wardrobeItemSchema } from "@/features/wardrobe/schemas";
import type { WardrobeItem } from "@/features/wardrobe";
import type { CandidateScore } from "@/lib/recommendation";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

export interface GetWardrobeCandidatesInput {
  userId: string;
  weather?: ClothingConstraints;
  occasionTags?: readonly string[];
  targetFormality?: number;
  favoriteColors?: readonly string[];
  avoidedColors?: readonly string[];
  preferredFits?: readonly string[];
  likedItemIds?: readonly string[];
  dislikedItemIds?: readonly string[];
}

function buildRoleShortlist(
  eligible: readonly WardrobeItem[],
  scoreById: ReadonlyMap<string, CandidateScore>,
): WardrobeItem[] {
  const byRole = new Map<string, WardrobeItem[]>();
  for (const item of eligible) {
    const role = resolveWardrobeItemRole(item);
    if (!role) continue;
    const group = byRole.get(role) ?? [];
    group.push(item);
    byRole.set(role, group);
  }
  return [...byRole.values()].flatMap((group) =>
    group
      .sort(
        (first, second) =>
          (scoreById.get(second.id)?.total ?? 0) - (scoreById.get(first.id)?.total ?? 0),
      )
      .slice(0, 10),
  );
}

function parseWardrobeRow(row: Record<string, unknown>): WardrobeItem {
  const keys = Object.keys(wardrobeItemSchema.shape);
  return wardrobeItemSchema.parse(Object.fromEntries(keys.map((key) => [key, row[key]])));
}

const PAGE_SIZE = 500;

export async function getWardrobeCandidates(input: GetWardrobeCandidatesInput) {
  const supabase = await createClient();
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", input.userId)
      .eq("status", "active")
      .eq("availability_status", "available")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const items = rows.map((row) => parseWardrobeRow(row));
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
