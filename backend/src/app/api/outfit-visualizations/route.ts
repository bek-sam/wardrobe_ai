import { NextResponse } from "next/server";

import { createVisualizationSchema, TRYON_POLL_INTERVALS_MS } from "@/lib/visualization";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
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
async function handleCreateVisualization(
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

export const runtime = "nodejs";

const ACCEPTED = new Set(["created", "reused", "already_fresh"]);

/**
 * Enqueues only. The long paid image call belongs to the durable worker, not
 * to this request's lifecycle, so this returns immediately with a status the
 * client polls.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, createVisualizationSchema),
      createClient(),
    ]);

    const result = await handleCreateVisualization(supabase, viewer.id, input);
    const accepted = ACCEPTED.has(result.outcome);
    return NextResponse.json(
      { data: { ...result, pollAfterMs: TRYON_POLL_INTERVALS_MS[0] } },
      { status: accepted ? 202 : 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
