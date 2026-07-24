import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export async function verifyDeletionRequest(
  supabase: SupabaseClient,
  viewer: { id: string; email?: string | null },
  confirmation: string,
  password: string,
) {
  if (confirmation !== viewer.id) {
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

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: viewer.email,
    password,
  });
  if (reauthError) {
    throw new ApiError(
      401,
      "reauthentication_failed",
      "Re-enter your current password to delete your account.",
    );
  }
}
