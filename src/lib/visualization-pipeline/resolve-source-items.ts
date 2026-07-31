import type { SupabaseClient } from "@supabase/supabase-js";

import type { OutfitItemRole } from "@/features/outfits/types";
import { ApiError } from "@/lib/api/response";
import type { CreateVisualizationInput } from "@/lib/visualization";

export type SourceSelection = { item_id: string; role: OutfitItemRole; sort_order: number };

const SOURCE_TABLES = {
  candidate: { table: "outfit_candidates", join: "outfit_candidate_items", key: "candidate_id" },
  outfit: { table: "outfits", join: "outfit_items", key: "outfit_id" },
} as const;

async function selectionsFor(
  supabase: SupabaseClient,
  userId: string,
  kind: "candidate" | "outfit",
  sourceId: string,
): Promise<SourceSelection[]> {
  const config = SOURCE_TABLES[kind];
  const { data, error } = await supabase
    .from(config.join)
    .select("item_id, role, sort_order")
    .eq("user_id", userId)
    .eq(config.key, sourceId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) throw new ApiError(404, "not_found", "That look was not found.");
  return data as SourceSelection[];
}

/**
 * Normalizes every supported source into one ordered selection, always scoped
 * to the authenticated viewer's own rows. A plan resolves through its outfit;
 * a composition is the caller's explicit selection, which the creating RPC
 * independently re-verifies against owned, active, available items.
 */
export async function resolveSourceSelections(
  supabase: SupabaseClient,
  userId: string,
  input: CreateVisualizationInput,
): Promise<SourceSelection[]> {
  if (input.sourceKind === "composition") return input.items as SourceSelection[];
  if (input.sourceKind !== "plan") {
    return selectionsFor(supabase, userId, input.sourceKind, input.sourceId as string);
  }

  const { data, error } = await supabase
    .from("outfit_plans")
    .select("outfit_id")
    .eq("id", input.sourceId as string)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.outfit_id) throw new ApiError(404, "not_found", "That plan has no outfit yet.");
  return selectionsFor(supabase, userId, "outfit", data.outfit_id as string);
}
