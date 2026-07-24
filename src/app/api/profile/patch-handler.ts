import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { ApiError } from "@/lib/api/response";

import { throwDatabaseError, throwNotFound } from "../_lib/route";
import type { profileUpdateSchema } from "../_lib/schemas";
import { buildProfilePatch } from "./build-profile-patch";
import { validateOwnedPaths } from "./validate-owned-paths";

type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export async function handleUpdateProfile(
  supabase: SupabaseClient,
  userId: string,
  input: ProfileUpdateInput,
) {
  validateOwnedPaths(userId, input);
  const patch = buildProfilePatch(input);

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select()
    .maybeSingle();
  if (error?.code === "23514") {
    throw new ApiError(
      422,
      "consent_requires_reference",
      "Upload an identity reference photo before enabling modeled previews.",
    );
  }
  throwDatabaseError(error, "Could not update the profile.");
  if (!data) throwNotFound("Profile");
  return data;
}
