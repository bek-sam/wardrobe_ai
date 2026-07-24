import { researchProduct } from "@/lib/ai/agents/research-agent";
import { createAdminClient } from "@/lib/supabase/admin";

import { recordResearchCompletion } from "./record-completion";
import { recordResearchFailure } from "./record-failure";
import type { ResearchRun } from "./types";
import { upsertResearchSources } from "./upsert-sources";

export async function processResearchRun(runId: string, expectedUserId?: string) {
  const admin = createAdminClient();
  let query = admin.from("item_research_runs").select("*").eq("id", runId);
  if (expectedUserId) query = query.eq("user_id", expectedUserId);
  const { data, error } = await query.single();
  if (error || !data) throw error ?? new Error("Research run not found.");
  const run = data as ResearchRun;
  if (!["queued", "running", "failed"].includes(run.status)) {
    return { runId, status: run.status };
  }

  await admin
    .from("item_research_runs")
    .update({ status: "running", error_code: null, error_message: null })
    .eq("id", run.id)
    .eq("user_id", run.user_id);

  try {
    const researched = await researchProduct(run.user_id, run.input_clues);
    await upsertResearchSources(admin, run, researched);
    await recordResearchCompletion(admin, run, researched);
    return { runId, status: researched.result.status };
  } catch (error) {
    await recordResearchFailure(admin, run);
    throw error;
  }
}
