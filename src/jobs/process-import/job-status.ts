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
