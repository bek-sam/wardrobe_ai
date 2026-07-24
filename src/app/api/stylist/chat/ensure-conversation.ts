import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export async function ensureConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string | null,
  message: string,
): Promise<string> {
  if (conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "conversation_not_found", "Conversation not found.");
    return conversationId;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title: message.slice(0, 80) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
