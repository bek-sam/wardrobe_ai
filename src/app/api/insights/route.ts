import { NextResponse } from "next/server";

import { routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { computeWardrobeInsights } from "@/lib/insights";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const data = await computeWardrobeInsights(supabase, viewer.id);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
