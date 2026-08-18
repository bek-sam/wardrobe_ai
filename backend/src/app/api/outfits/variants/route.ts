import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { answerOutfitVariants } from "@/lib/ai/agents/orchestrator/variants";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import { generateOutfitRequestSchema } from "@/features/stylist";

/**
 * The studio's request adds locked item IDs. They are a *hard* constraint
 * enforced deterministically server-side: a candidate that does not contain
 * every locked ID is filtered out before the model is ever asked to explain
 * anything, so remix cannot change a locked piece.
 */
const outfitVariantsRequestSchema = generateOutfitRequestSchema.omit({ save: true }).extend({
  lockedItemIds: z.array(z.string().uuid()).max(6).default([]),
});

type VariantsInput = z.infer<typeof outfitVariantsRequestSchema>;

/**
 * Charges exactly one stylist unit for the whole three-variant request. The
 * agent makes one model call for all three looks, so billing per variant would
 * over-charge for work that never happened.
 */
async function handleOutfitVariants(
  supabase: SupabaseClient,
  userId: string,
  input: VariantsInput,
) {
  const environment = getServerEnvironment();
  await enforceAiUsageLimits(supabase, {
    feature: "stylist_generation",
    dailyLimit: environment.DAILY_STYLIST_LIMIT,
    rollingBucket: "stylist_generation",
    rollingLimit: environment.STYLIST_RATE_LIMIT_PER_MINUTE,
  });

  return answerOutfitVariants(
    {
      userId,
      request: input.message,
      date: input.date,
      location: input.location,
      occasion: input.occasion,
      targetFormality: input.targetFormality,
      indoorOutdoor: input.indoorOutdoor,
    },
    input.lockedItemIds,
  );
}

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The Outfit Studio's request endpoint: three meaningfully different looks
 * (Safe, Fresh, Statement) built only from exact owned, available garments.
 * Makes no image-generation call — the flat lay renders from stored cut-outs.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, outfitVariantsRequestSchema),
      createClient(),
    ]);

    const data = await handleOutfitVariants(supabase, viewer.id, input);
    return ok(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
