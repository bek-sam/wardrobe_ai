import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import { ApiError } from "@/lib/api/response";
import {
  assessIdentitySuitability,
  IdentityUploadError,
  normalizeIdentityUpload,
  storeIdentityReference,
} from "@/lib/identity-reference";
import { assertOwnedStoragePath, downloadPrivateObject } from "@/lib/storage/private-images";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reads the just-uploaded object, validates and normalizes the decoded bytes,
 * runs the structured suitability check, and stores a *new* server-pathed
 * object. The client-supplied path is used exactly once, to read bytes, and is
 * ownership-checked first; it is never persisted and its object is queued for
 * deletion so an unnormalized copy carrying EXIF cannot linger.
 */
export async function handleConfirmIdentityUpload(
  supabase: SupabaseClient,
  userId: string,
  storagePath: string,
) {
  // A paid vision call runs below, so this is budgeted like every other
  // model-backed route. Without it the same upload could be confirmed on a
  // loop, each replay costing a call and storing another copy of the photo.
  const environment = getServerEnvironment();
  await enforceAiUsageLimits(supabase, {
    feature: "identity_reference_assessment",
    dailyLimit: environment.IDENTITY_ASSESSMENT_DAILY_LIMIT,
    rollingBucket: "identity_reference_assessment",
    rollingLimit: environment.IDENTITY_ASSESSMENT_RATE_LIMIT_PER_MINUTE,
  });

  assertOwnedStoragePath(storagePath, userId);
  const admin = createAdminClient();
  const bucket = environment.PROFILE_REFERENCES_BUCKET;

  const raw = await downloadPrivateObject(admin, bucket, storagePath, userId).catch(() => null);
  if (!raw) throw new ApiError(404, "upload_not_found", "That upload could not be found.");

  try {
    const normalized = await normalizeIdentityUpload(raw);
    const assessment = await assessIdentitySuitability(userId, normalized.bytes);
    const reference = await storeIdentityReference(admin, userId, normalized, assessment);
    await admin.rpc("enqueue_storage_deletion", {
      p_user_id: userId,
      p_bucket_id: bucket,
      p_storage_path: storagePath,
      p_reason: "identity_reference_raw_upload",
    });
    return { reference, assessment };
  } catch (error) {
    if (error instanceof IdentityUploadError) {
      throw new ApiError(422, `identity_${error.code}`, error.message);
    }
    throw error;
  }
}
