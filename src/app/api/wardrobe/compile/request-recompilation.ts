import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export async function requestRecompilation(
  supabase: SupabaseClient,
): Promise<"up_to_date" | "already_running" | null> {
  const { data: requested, error } = await supabase.rpc("request_wardrobe_recompilation");
  if (error?.code === "PT429") {
    throw new ApiError(
      429,
      "recompile_rate_limited",
      "Too many recompile requests. Try again in a few minutes.",
    );
  }
  if (error) throw error;

  const status =
    requested && typeof requested === "object" && "status" in requested ? requested.status : null;
  if (status === "up_to_date") return "up_to_date";
  if (status === "already_running") return "already_running";
  return null;
}
