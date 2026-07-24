import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError } from "@/app/api/_lib/route";
import { sanitizeStylistStructuredResult } from "@/features/stylist/history";

import { clippedText } from "./clipped-text";

export async function fetchMessages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  offset: number,
  limit: number,
) {
  const { data, error, count } = await supabase
    .from("messages")
    .select("id, role, content, structured_result, created_at", { count: "exact" })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  throwDatabaseError(error, "Could not load conversation messages.");

  const messages = [...(data ?? [])].reverse().map((message) => ({
    id: message.id,
    role: message.role,
    content: clippedText(message.content, 4_000),
    structured_result:
      message.role === "assistant"
        ? sanitizeStylistStructuredResult(message.structured_result)
        : null,
    created_at: message.created_at,
  }));

  return { messages, count: count ?? 0 };
}
