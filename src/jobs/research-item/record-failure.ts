import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResearchRun } from "./types";

export async function recordResearchFailure(admin: SupabaseClient, run: ResearchRun) {
  await admin
    .from("item_research_runs")
    .update({
      status: "failed",
      error_code: "research_failed",
      error_message: "Product research could not be completed.",
      locked_at: null,
      locked_until: null,
      next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id);
}
