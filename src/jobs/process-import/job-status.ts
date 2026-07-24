import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportJobRow } from "./types";

export async function isJobCancelled(
  admin: SupabaseClient,
  job: Pick<ImportJobRow, "id" | "user_id">,
) {
  const { data } = await admin
    .from("import_jobs")
    .select("status")
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  return data?.status === "cancelled";
}

// Shared guard for writes to import_jobs that must not clobber a job that
// already reached a terminal state -- centralized so every call site stays
// in sync if a third terminal status is ever added.
export function excludeTerminalJobStatuses<
  Q extends { not: (column: string, operator: string, value: string) => Q },
>(query: Q): Q {
  return query.not("status", "in", "(complete,cancelled)");
}
