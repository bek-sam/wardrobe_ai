import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteAuthUser(supabase: SupabaseClient, userId: string) {
  const admin = createAdminClient();
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    throw new ApiError(
      500,
      "account_deletion_failed",
      "Could not delete the account. Retry deletion; private files already queued for removal are unaffected.",
    );
  }

  const { error: completeError } = await admin
    .from("account_deletion_requests")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "deleting_auth_user");
  if (completeError) {
    // The Auth user is already gone; only the audit record's closing
    // timestamp failed to write. Not user-facing - log without secrets.
    console.error("account_deletion_complete_record_failed", { code: completeError.code });
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The account is already deleted; local sign-out is best-effort cleanup.
  }
}
