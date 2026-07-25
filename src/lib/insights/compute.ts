import type { SupabaseClient } from "@supabase/supabase-js";

import { buildWardrobeInsights } from "./build-insights";
import { fetchInsightItems } from "./fetch-items";

export async function computeWardrobeInsights(supabase: SupabaseClient, userId: string) {
  return buildWardrobeInsights(await fetchInsightItems(supabase, userId));
}
