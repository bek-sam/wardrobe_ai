import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActiveIdentityReference } from "@/lib/identity-reference";
import type { VisualizationRequestResult, VisualizationSnapshotItem } from "@/lib/visualization";

import type { GenerationConfig } from "./generation-config";
import { normalizeRequestOutcome } from "./normalize-outcome";
import { snapshotRpcItems, snapshotSourceHash } from "./snapshot-hash";

export type RequestVisualizationInput = {
  sourceKind: string;
  sourceId: string | null;
  snapshot: readonly VisualizationSnapshotItem[];
  identity: ActiveIdentityReference;
  config: GenerationConfig;
};

/**
 * Computes the freshness hash and hands the snapshot to the transactional RPC,
 * which owns ownership re-verification, dedupe, rate limiting, the queue cap,
 * and the paid quota. Nothing here decides whether to spend money.
 */
export async function requestVisualization(
  supabase: SupabaseClient,
  input: RequestVisualizationInput,
): Promise<VisualizationRequestResult> {
  const { config } = input;

  const { data, error } = await supabase.rpc("request_outfit_visualization", {
    p_source_kind: input.sourceKind,
    p_source_id: input.sourceId,
    p_source_hash: snapshotSourceHash(input.snapshot, input.identity, config),
    p_items: snapshotRpcItems(input.snapshot),
    p_prompt_version: config.promptVersion,
    p_provider: config.providerName,
    p_model_key: config.modelKey,
    p_capability_version: config.capabilityVersion,
    p_output_size: config.outputSize,
    p_output_quality: config.outputQuality,
    p_qa_version: config.qaVersion,
    p_localization_version: config.localizationVersion,
  });
  if (error) throw error;
  return normalizeRequestOutcome(data);
}
