import { confirmIdentityUploadSchema } from "@/lib/visualization";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";
import { TRYON_CONSENT_VERSION } from "@/lib/visualization";
import { isVisualizationConfigured } from "@/lib/ai/visualization-provider";
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
async function handleConfirmIdentityUpload(
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

/**
 * The consent gate's state in one call: the active reference (if any), the
 * most recent candidate awaiting review, and whether the deployment can
 * generate at all. The preview URL is signed fresh here and never persisted.
 */
async function handleGetIdentityReferences(supabase: SupabaseClient, userId: string) {
  const environment = getServerEnvironment();
  const { data, error } = await supabase
    .from("profile_identity_references")
    .select(
      "id, storage_path, width, height, validation_status, validation_summary, is_active, consent_version, consented_at, created_at",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  const rows = data ?? [];
  const active = rows.find((row) => row.is_active) ?? null;
  const pending = rows.find((row) => !row.is_active && row.validation_status !== "fail") ?? null;
  const signable = active ?? pending;
  const previewUrl = signable
    ? await createPrivateSignedUrl(
        supabase,
        environment.PROFILE_REFERENCES_BUCKET,
        signable.storage_path as string,
        userId,
        environment.SIGNED_URL_TTL_SECONDS,
      ).catch(() => null)
    : null;

  return {
    active: active ? { ...active, storage_path: undefined } : null,
    pending: pending ? { ...pending, storage_path: undefined } : null,
    previewUrl,
    consentVersion: TRYON_CONSENT_VERSION,
    consentCurrent: active?.consent_version === TRYON_CONSENT_VERSION,
    tryOnConfigured: isVisualizationConfigured(),
  };
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const data = await handleGetIdentityReferences(supabase, viewer.id);
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, confirmIdentityUploadSchema),
      createClient(),
    ]);
    const data = await handleConfirmIdentityUpload(supabase, viewer.id, input.storagePath);
    return ok(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
