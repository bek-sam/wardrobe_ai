import type { SupabaseClient } from "@supabase/supabase-js";

import { clippedText } from "./clipped-text";
import { fetchConversation } from "./fetch-conversation";
import { fetchMessages } from "./fetch-messages";

export async function handleGetMessages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  filters: { offset: number; limit: number },
) {
  const conversation = await fetchConversation(supabase, userId, conversationId);
  const { messages, count } = await fetchMessages(
    supabase,
    userId,
    conversation.id,
    filters.offset,
    filters.limit,
  );

  return {
    conversation: { ...conversation, title: clippedText(conversation.title, 160) },
    messages,
    count,
    limit: filters.limit,
    offset: filters.offset,
    hasEarlierMessages: count > filters.offset + messages.length,
  };
}
