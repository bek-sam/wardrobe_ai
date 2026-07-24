import { parseQuery, parseRouteParams } from "@/app/api/_lib/route";
import {
  stylistConversationParamsSchema,
  stylistMessageListQuerySchema,
} from "@/features/stylist/schemas";
import { ok, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleGetMessages } from "./handler";

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
