import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";

export async function fetchConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the conversation.");
  if (!conversation) throwNotFound("Conversation");
  return conversation;
}
