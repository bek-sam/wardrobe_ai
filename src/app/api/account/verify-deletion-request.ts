import type { User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import { verifyPassword } from "@/lib/supabase/verifier";

import { consumeDeletionAuthorization } from "./deletion-challenge";
import { deletionReauthMethod } from "./reauthentication-method";

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
