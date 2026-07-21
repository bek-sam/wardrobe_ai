import {
  parseQuery,
  parseRouteParams,
  throwDatabaseError,
  throwNotFound,
} from "@/app/api/_lib/route";
import { sanitizeStylistStructuredResult } from "@/features/stylist/history";
import {
  stylistConversationParamsSchema,
  stylistMessageListQuerySchema,
} from "@/features/stylist/schemas";
import { ok, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ conversationId: string }> };

function clippedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

export async function GET(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { conversationId } = await parseRouteParams(
      context.params,
      stylistConversationParamsSchema,
    );
    const filters = parseQuery(request, stylistMessageListQuerySchema);
    const supabase = await createClient();
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("id", conversationId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(conversationError, "Could not load the conversation.");
    if (!conversation) throwNotFound("Conversation");

    const { data, error, count } = await supabase
      .from("messages")
      .select("id, role, content, structured_result, created_at", { count: "exact" })
      .eq("conversation_id", conversation.id)
      .eq("user_id", viewer.id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);
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

    return ok(
      {
        conversation: {
          ...conversation,
          title: clippedText(conversation.title, 160),
        },
        messages,
        count: count ?? 0,
        limit: filters.limit,
        offset: filters.offset,
        hasEarlierMessages: (count ?? 0) > filters.offset + messages.length,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
