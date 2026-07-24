import type { SupabaseClient } from "@supabase/supabase-js";

export async function handleGetResearchRuns(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
) {
  const { data, error } = await supabase
    .from("item_research_runs")
    .select("*, research_sources(*)")
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
