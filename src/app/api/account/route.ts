import { accountDeletionRequestSchema, accountDeletionSchema } from "@/app/api/_lib/schemas";
import { throwDatabaseError } from "@/app/api/_lib/route";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletion is two decoupled, retryable steps instead of one long synchronous
 * request: start_account_deletion() durably records the request and enqueues
 * every owned Storage object into the existing storage_deletion_queue (the
 * same queue wardrobe-image/import cleanup already uses), which the existing
 * background worker drains with its own retries. Only then is the Auth user
 * deleted through the Admin API. A crash between those two steps leaves a
 * `deleting_auth_user` row that a retried DELETE call resumes from, instead of
 * silently losing track of a partially completed deletion.
 */
export async function DELETE(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, accountDeletionSchema);
    if (input.confirmation !== viewer.id) {
      throw new ApiError(
        422,
        "confirmation_mismatch",
        "Account deletion confirmation must match the authenticated user ID.",
      );
    }
    if (!viewer.email) {
      throw new ApiError(
        409,
        "reauthentication_unavailable",
        "Account deletion requires password re-entry, which is unavailable for this sign-in method.",
      );
    }

    const supabase = await createClient();
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: viewer.email,
      password: input.password,
    });
    if (reauthError) {
      throw new ApiError(
        401,
        "reauthentication_failed",
        "Re-enter your current password to delete your account.",
      );
    }

    const { data: rawRequest, error: startError } = await supabase.rpc("start_account_deletion");
    throwDatabaseError(startError, "Could not prepare account deletion.");
    const parsedRequest = accountDeletionRequestSchema.safeParse(rawRequest);
    if (!parsedRequest.success || parsedRequest.data.user_id !== viewer.id) {
      throw new ApiError(500, "deletion_request_invalid", "Could not prepare account deletion.");
    }

    const { error: markError } = await supabase.rpc("mark_account_deletion_auth_pending");
    throwDatabaseError(markError, "Could not prepare account deletion.");

    const admin = createAdminClient();
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(viewer.id);
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
      .eq("user_id", viewer.id)
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

    return ok({
      deleted: true,
      user_id: viewer.id,
      storage_objects_queued: parsedRequest.data.storage_objects_total,
    });
  } catch (error) {
    return routeError(error);
  }
}
