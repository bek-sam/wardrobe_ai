import { NextResponse } from "next/server";

import { createVisualizationSchema, TRYON_POLL_INTERVALS_MS } from "@/lib/visualization";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleCreateVisualization } from "./post-handler";

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
