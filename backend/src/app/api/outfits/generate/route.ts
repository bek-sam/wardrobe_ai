import { NextResponse } from "next/server";

import { generateOutfitRequestSchema } from "@/features/stylist";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { runWardrobeOutfitRequest } from "@/lib/ai/agents/orchestrator/run";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

type GenerateOutfitInput = z.infer<typeof generateOutfitRequestSchema>;

async function handleGenerateOutfit(
  supabase: SupabaseClient,
  userId: string,
  input: GenerateOutfitInput,
) {
  const environment = getServerEnvironment();
  await enforceAiUsageLimits(supabase, {
    feature: "stylist_generation",
    dailyLimit: environment.DAILY_STYLIST_LIMIT,
    rollingBucket: "stylist_generation",
    rollingLimit: environment.STYLIST_RATE_LIMIT_PER_MINUTE,
  });

  const result = await runWardrobeOutfitRequest({
    userId,
    request: input.message,
    date: input.date,
    location: input.location,
    occasion: input.occasion,
    targetFormality: input.targetFormality,
    indoorOutdoor: input.indoorOutdoor,
  });

  let savedOutfit: unknown = null;
  if (input.save) {
    if (!result.generationId) {
      throw new Error("The generated outfit could not be recorded for safe saving.");
    }
    const { data, error } = await supabase.rpc("save_recorded_generated_outfit", {
      p_generation_id: result.generationId,
    });
    if (error) throw error;
    savedOutfit = data;
  }

  return { ...result, savedOutfit };
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, generateOutfitRequestSchema),
      createClient(),
    ]);

    const data = await handleGenerateOutfit(supabase, viewer.id, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
