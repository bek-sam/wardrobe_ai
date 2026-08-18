import { ok, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/server";
import { buildWardrobeInsights, fetchInsightItems } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const viewer = await requireViewer();
    const data = buildWardrobeInsights(await fetchInsightItems(await createClient(), viewer.id));
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
