import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError } from "@/app/api/_lib/route";
import { accountDeletionRequestSchema } from "@/app/api/_lib/schemas";
import { ApiError } from "@/lib/api/response";

export async function startDeletion(supabase: SupabaseClient, userId: string) {
  const { data: rawRequest, error: startError } = await supabase.rpc("start_account_deletion");
  throwDatabaseError(startError, "Could not prepare account deletion.");
  const parsedRequest = accountDeletionRequestSchema.safeParse(rawRequest);
  if (!parsedRequest.success || parsedRequest.data.user_id !== userId) {
    throw new ApiError(500, "deletion_request_invalid", "Could not prepare account deletion.");
  }

  const { error: markError } = await supabase.rpc("mark_account_deletion_auth_pending");
  throwDatabaseError(markError, "Could not prepare account deletion.");

  return parsedRequest.data;
}
