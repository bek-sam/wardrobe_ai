import { createAdminClient } from "@/lib/supabase/admin";

type RecordAgentRunInput = {
  userId: string;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  model: string;
  latencyMs: number;
  usage: unknown;
};

export async function recordWardrobeOrchestratorRun({
  userId,
  inputSummary,
  outputSummary,
  model,
  latencyMs,
  usage,
}: RecordAgentRunInput): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agent_runs")
    .insert({
      user_id: userId,
      agent_type: "wardrobe_orchestrator",
      status: "complete",
      input_summary: inputSummary,
      output_summary: outputSummary,
      model,
      latency_ms: latencyMs,
      usage,
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}
