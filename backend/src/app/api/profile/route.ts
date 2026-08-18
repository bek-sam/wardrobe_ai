import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

import { profileUpdateSchema } from "../_lib/schemas";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDatabaseError, throwNotFound } from "../_lib/route";
import { ApiError } from "@/lib/api/response";

type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

function buildProfilePatch(input: ProfileUpdateInput) {
  const patch: ProfileUpdateInput & { modeled_preview_consent_at?: string | null } = { ...input };
  if (input.modeled_preview_consent === true) {
    patch.modeled_preview_consent_at = new Date().toISOString();
  } else if (input.modeled_preview_consent === false) {
    patch.modeled_preview_consent_at = null;
  }
  return patch;
}

async function handleGetProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the profile.");
  if (!data) throwNotFound("Profile");
  return data;
}

type ProfilePathInput = z.infer<typeof profileUpdateSchema>;

function validateOwnedPaths(userId: string, input: ProfilePathInput) {
  if (input.avatar_path && !input.avatar_path.startsWith(`${userId}/`)) {
    throw new ApiError(
      422,
      "validation_failed",
      "The avatar path must belong to the authenticated user.",
    );
  }
  if (input.identity_reference_path && !input.identity_reference_path.startsWith(`${userId}/`)) {
    throw new ApiError(
      422,
      "validation_failed",
      "The identity reference path must belong to the authenticated user.",
    );
  }
}

type ProfilePatchInput = z.infer<typeof profileUpdateSchema>;

async function handleUpdateProfile(
  supabase: SupabaseClient,
  userId: string,
  input: ProfilePatchInput,
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

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const data = await handleGetProfile(supabase, viewer.id);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, profileUpdateSchema);
    const supabase = await createClient();
    const data = await handleUpdateProfile(supabase, viewer.id, input);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
