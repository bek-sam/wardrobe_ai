import type { SupabaseClient } from "@supabase/supabase-js";

import type { researchProduct } from "@/lib/ai/agents/research-agent";
import { getServerEnvironment } from "@/lib/env/server";

import { proposedChanges } from "./proposed-changes";
import type { ResearchRun } from "./types";

export async function recordResearchCompletion(
  admin: SupabaseClient,
  run: ResearchRun,
  researched: Awaited<ReturnType<typeof researchProduct>>,
) {
  const { error: updateError } = await admin
    .from("item_research_runs")
    .update({
      status: researched.result.status,
      confidence: researched.result.confidence,
      summary: researched.result.summary,
      proposed_changes: proposedChanges(researched.result),
      evidence: researched.result.evidence,
      model: getServerEnvironment().OPENAI_RESEARCH_MODEL,
      locked_at: null,
      locked_until: null,
      next_attempt_at: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", run.user_id);
  if (updateError) throw updateError;

  await admin.from("agent_runs").insert({
    user_id: run.user_id,
    agent_type: "product_research",
    status: "complete",
    input_summary: { itemId: run.item_id, researchRunId: run.id },
    output_summary: {
      researchStatus: researched.result.status,
      confidence: researched.result.confidence,
      sourceCount: researched.sources.length,
      responseId: researched.responseId,
    },
    model: getServerEnvironment().OPENAI_RESEARCH_MODEL,
    usage: researched.usage ?? {},
  });
}
