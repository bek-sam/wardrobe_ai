import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountDeletionRequestSchema } from "@/app/api/_lib/schemas";
import { throwDatabaseError } from "@/app/api/_lib/route";
import type { User } from "@supabase/supabase-js";
import { hasPasswordIdentity, userIdentities } from "@/lib/auth/server";
import { verifyPassword } from "@/lib/supabase/verifier";
import { consumeDeletionAuthorization } from "./deletion-challenge";

/**
 * Removes the Auth identity, then records the *honest* next state.
 *
 * The old implementation wrote 'complete' here unconditionally, while the
 * user's private images were still queued for a background worker. Now the
 * database decides: no outstanding objects means the deletion really is
 * finished, anything else means `auth_deleted_storage_pending` until the
 * worker drains the queue.
 */
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
  await recordAuthEvent({ type: "deletion_auth_user_deleted", result: "success" });

  const { data, error } = await admin.rpc("mark_account_deletion_auth_deleted", {
    p_user_id: userId,
  });
  if (error) {
    // The identity is gone either way; only the audit transition failed.
    console.error("account_deletion_state_transition_failed", { code: error.code });
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The account is already deleted; local sign-out is best-effort cleanup.
  }

  const parsed = accountDeletionRequestSchema.safeParse(data);
  return parsed.success ? parsed.data.status : "auth_deleted_storage_pending";
}

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

export type DeletionReauthMethod = "password" | "oauth" | "email_link";

/**
 * How this particular account must prove it is really them before deletion.
 *
 * The rule the previous implementation got wrong: it treated "the user has an
 * email claim" as "the user has a password", then demanded one. A Google-only
 * account has an email and no password, so those users could never delete
 * their account at all. Only an `email` *identity* means a password exists.
 *
 * Everyone else proves identity through a provider round trip — Google for
 * linked accounts, a one-time email link for passwordless ones — which is why
 * the return leg is bound to a challenge rather than trusted on its own.
 */
export function deletionReauthMethod(user: User): DeletionReauthMethod {
  const identities = userIdentities(user);
  if (hasPasswordIdentity(identities)) return "password";
  if (identities.some((identity) => identity.provider === "google")) return "oauth";
  return "email_link";
}

/**
 * Proves the person asking to delete the account is its owner, by whichever
 * means that account actually supports.
 *
 * Password accounts re-enter their password. Google and passwordless accounts
 * present a one-time challenge established by the provider round trip.
 */
export async function verifyDeletionRequest(
  user: User,
  confirmation: string,
  password: string,
): Promise<void> {
  if (confirmation !== user.id) {
    throw new ApiError(
      422,
      "confirmation_mismatch",
      "Account deletion confirmation must match the authenticated user ID.",
    );
  }

  if (deletionReauthMethod(user) === "password") {
    if (!user.email || !(await verifyPassword(user.email, password))) {
      throw new ApiError(
        401,
        "reauthentication_failed",
        "Re-enter your current password to delete your account.",
      );
    }
    return;
  }

  if (!(await consumeDeletionAuthorization(user.id))) {
    throw new ApiError(
      401,
      "reauthentication_required",
      "Confirm your identity again before deleting your account.",
    );
  }
}

/**
 * Deletion is decoupled, retryable steps rather than one long request:
 * `start_account_deletion()` durably records the request and enqueues every
 * owned Storage object onto the queue the background worker already drains,
 * and only then is the Auth user removed through the Admin API. A crash
 * between those steps leaves a `deleting_auth_user` row that a retried call
 * resumes from, instead of losing track of a half-finished deletion.
 *
 * What the caller is told is now precise. `storage_complete: false` means the
 * account is unreachable and its rows are gone, while its private files are
 * still being removed in the background — which is the truth, and is what the
 * confirmation screen says.
 */
export async function handleDeleteAccount(
  supabase: SupabaseClient,
  user: User,
  confirmation: string,
  password: string,
) {
  await verifyDeletionRequest(user, confirmation, password);
  await recordAuthEvent({ type: "deletion_requested", result: "success", userId: user.id });

  const deletionRequest = await startDeletion(supabase, user.id);
  const status = await deleteAuthUser(supabase, user.id);

  return {
    deleted: true,
    user_id: user.id,
    status,
    storage_objects_queued: deletionRequest.storage_objects_total,
    storage_complete: status === "complete",
  };
}
