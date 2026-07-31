import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { answerOutfitVariants } from "@/lib/ai/agents/orchestrator/variants";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import type { outfitVariantsRequestSchema } from "@/features/studio/schemas";

type VariantsInput = z.infer<typeof outfitVariantsRequestSchema>;

/**
 * Charges exactly one stylist unit for the whole three-variant request. The
 * agent makes one model call for all three looks, so billing per variant would
 * over-charge for work that never happened.
 */
export async function handleOutfitVariants(
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
