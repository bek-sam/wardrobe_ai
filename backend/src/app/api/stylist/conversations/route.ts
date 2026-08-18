import { parseQuery, throwDatabaseError } from "@/app/api/_lib/route";
import { stylistConversationListQuerySchema } from "@/features/stylist";
import { ok, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

function clippedTitle(value: unknown) {
  return typeof value === "string" ? value.slice(0, 160) : "Conversation";
}

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, stylistConversationListQuerySchema);
    const supabase = await createClient();
    const { data, error, count } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at", { count: "exact" })
      .eq("user_id", viewer.id)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);
    throwDatabaseError(error, "Could not load recent conversations.");

    return ok(
      {
        conversations: (data ?? []).map((conversation) => ({
          ...conversation,
          title: clippedTitle(conversation.title),
        })),
        count: count ?? 0,
        limit: filters.limit,
        offset: filters.offset,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
