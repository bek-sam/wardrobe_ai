import { createAdminClient } from "@/lib/supabase/admin";

import type { ImportJobRow } from "./types";

export async function loadJob(jobId: string, expectedUserId?: string): Promise<ImportJobRow> {
  const admin = createAdminClient();
  let query = admin.from("import_jobs").select("*").eq("id", jobId);
  if (expectedUserId) query = query.eq("user_id", expectedUserId);
  const { data, error } = await query.single();
  if (error || !data) throw error ?? new Error("Import job not found.");
  return data as ImportJobRow;
}
