import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { stylistRequestSchema } from "@/features/stylist/schemas";

import { buildResponseStream } from "./build-response-stream";
import { ensureConversation } from "./ensure-conversation";
import { resolveChatIntentWithQuota } from "./resolve-chat-intent";

type StylistRequestInput = z.infer<typeof stylistRequestSchema>;

export async function handleStylistChat(
  supabase: SupabaseClient,
  userId: string,
  input: StylistRequestInput,
) {
  // Route first, then charge: a deterministic wardrobe lookup or insight must
  // not spend a stylist generation, and a planning or packing turn must spend
  // exactly one planner unit rather than one of each.
  const resolved = await resolveChatIntentWithQuota(supabase, {
    userId,
    request: input.message,
    date: input.date,
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

  return buildResponseStream(supabase, userId, conversationId, input, resolved);
}
