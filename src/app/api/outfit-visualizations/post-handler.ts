import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import { loadActiveIdentityReference } from "@/lib/identity-reference";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRYON_CONSENT_VERSION, type CreateVisualizationInput } from "@/lib/visualization";
import {
  buildVisualizationSnapshot,
  requestVisualization,
  requireGenerationConfig,
  resolveSourceSelections,
} from "@/lib/visualization-pipeline";

/**
 * Resolves the source under the caller's own id, builds the immutable
 * snapshot, then delegates every spend decision to the transactional RPC.
 * Consent is checked here so the user gets an actionable outcome before a
 * quota unit is even considered.
 */
export async function handleCreateVisualization(
  supabase: SupabaseClient,
  userId: string,
  input: CreateVisualizationInput,
) {
  const identity = await loadActiveIdentityReference(supabase, userId);
  if (!identity) return { outcome: "needs_identity" as const };
  if (identity.consentVersion !== TRYON_CONSENT_VERSION) {
    return { outcome: "needs_consent" as const, consentVersion: TRYON_CONSENT_VERSION };
  }

  const selections = await resolveSourceSelections(supabase, userId, input);
  const snapshot = await buildVisualizationSnapshot(createAdminClient(), userId, selections);
  const config = requireGenerationConfig();

  const result = await requestVisualization(supabase, {
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    snapshot,
    identity,
    config,
  }).catch((error: { code?: string }) => {
    if (error?.code === "PT429") {
      throw new ApiError(
        429,
        "visualization_rate_limited",
        "You've asked for several try-ons in a row. Wait a moment and try again.",
      );
    }
    throw error;
  });

  return result;
}
