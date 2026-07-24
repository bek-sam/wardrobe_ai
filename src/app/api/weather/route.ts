import { NextResponse } from "next/server";

import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleGetWeather } from "./handler";
import { querySchema } from "./schema";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new ApiError(422, "invalid_weather_query", "The weather date or location is invalid.");
    }
    const supabase = await createClient();

    const data = await handleGetWeather(supabase, viewer.id, parsed.data);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
