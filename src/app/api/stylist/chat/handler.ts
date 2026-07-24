import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { stylistRequestSchema } from "@/features/stylist/schemas";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

import { buildResponseStream } from "./build-response-stream";
import { ensureConversation } from "./ensure-conversation";

type StylistRequestInput = z.infer<typeof stylistRequestSchema>;

export async function handleStylistChat(
  supabase: SupabaseClient,
  userId: string,
  input: StylistRequestInput,
) {
  const environment = getServerEnvironment();
  await enforceAiUsageLimits(supabase, {
    feature: "stylist_generation",
    dailyLimit: environment.DAILY_STYLIST_LIMIT,
    rollingBucket: "stylist_generation",
    rollingLimit: environment.STYLIST_RATE_LIMIT_PER_MINUTE,
  });

  const conversationId = await ensureConversation(
    supabase,
    userId,
    input.conversationId ?? null,
    input.message,
  );

  const { error: messageError } = await supabase.from("messages").insert({
    user_id: userId,
    conversation_id: conversationId,
    role: "user",
    content: input.message,
    structured_result: null,
  });
  if (messageError) throw messageError;

  return buildResponseStream(supabase, userId, conversationId, input);
}
