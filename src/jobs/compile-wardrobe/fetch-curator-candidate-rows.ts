import type { WardrobeItem } from "@/features/wardrobe/types";

import { parseWardrobeRow } from "./parse-wardrobe-row";
import type { AdminClient, CuratorCandidateRow } from "./types";

export async function fetchCuratorCandidateRows(
  admin: AdminClient,
  userId: string,
  compiledWardrobeVersion: string,
): Promise<{ rows: CuratorCandidateRow[]; itemsById: Map<string, WardrobeItem> }> {
  const { data: candidateRows } = await admin
    .from("outfit_candidates")
    .select(
      "id, combination_key, occasion_category, curator_status, created_at, total_score, formality_level, " +
        "warmth_level, color_harmony, layering_quality, occasion_formality, preference_match, variety, " +
        "weather_tags, outfit_candidate_items(item_id, role)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("compiled_wardrobe_version", compiledWardrobeVersion)
    .order("total_score", { ascending: false })
    .limit(2000);
  const rows = (candidateRows ?? []) as unknown as CuratorCandidateRow[];
  if (rows.length === 0) return { rows, itemsById: new Map() };

  const allItemIds = [
    ...new Set(rows.flatMap((row) => (row.outfit_candidate_items ?? []).map((m) => m.item_id))),
  ];
  const { data: itemRows } = allItemIds.length
    ? await admin.from("wardrobe_items").select("*").eq("user_id", userId).in("id", allItemIds)
    : { data: [] as Record<string, unknown>[] };
  const itemsById = new Map(
    (itemRows ?? []).map((row) => [
      row.id as string,
      parseWardrobeRow(row as Record<string, unknown>),
    ]),
  );

  return { rows, itemsById };
}
