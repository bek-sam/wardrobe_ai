import { parseQuery, parseRouteParams } from "@/app/api/_lib/route";
import { stylistConversationParamsSchema, stylistMessageListQuerySchema } from "@/features/stylist";
import { ok, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { sanitizeStylistStructuredResult } from "@/features/stylist";

function clippedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

async function fetchMessages(
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

async function fetchConversation(supabase: SupabaseClient, userId: string, conversationId: string) {
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

async function handleGetMessages(
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

type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { conversationId } = await parseRouteParams(
      context.params,
      stylistConversationParamsSchema,
    );
    const filters = parseQuery(request, stylistMessageListQuerySchema);
    const supabase = await createClient();

    const data = await handleGetMessages(supabase, viewer.id, conversationId, filters);
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
