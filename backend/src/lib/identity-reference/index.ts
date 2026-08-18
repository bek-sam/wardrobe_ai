import { resolveVisualizationProvider } from "@/lib/ai/visualization-provider";
import type { IdentityReferenceAssessment } from "@/lib/visualization";
import type { ImageLimits } from "@/lib/image/validation";
import type { ValidatedImage } from "@/lib/image/validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAndNormalizeImage } from "@/lib/image/validation";
import { sha256Hex } from "@/lib/visualization/server";
import { randomUUID } from "node:crypto";
import { getServerEnvironment } from "@/lib/env/server";
import { uploadPrivateObject } from "@/lib/storage/private-images";

/**
 * Structured suitability check. Fails closed: when the try-on provider is not
 * configured, this throws rather than fabricating a "pass", so a photo can
 * never be activated on a deployment that could not actually check it.
 */
export async function assessIdentitySuitability(
  userId: string,
  image: Buffer,
): Promise<IdentityReferenceAssessment> {
  return resolveVisualizationProvider().assessIdentity({ userId, image });
}

/**
 * A "warn" verdict is a borderline framing note the user may override, so it
 * still reaches storage as activatable. "fail" (no person, several people, an
 * unreadable file, moderated input) never does.
 */
export function validationStatusFor(
  assessment: IdentityReferenceAssessment,
): "pass" | "warn" | "fail" {
  if (assessment.verdict === "fail") return "fail";
  if (assessment.personCount !== 1 || !assessment.faceVisible) return "fail";
  return assessment.verdict;
}

/**
 * Tighter than the wardrobe-photo limits: an identity reference is rendered
 * from, not catalogued, so an enormous file buys nothing and a tiny one cannot
 * carry a recognizable face.
 */
export const IDENTITY_IMAGE_LIMITS: ImageLimits = {
  maxBytes: 20 * 1024 * 1024,
  maxPixels: 30_000_000,
  maxEdge: 8_000,
  minEdge: 320,
};

/**
 * A full-body reference is portrait or roughly square. A very wide photo is
 * almost always a group shot or a landscape crop, and is rejected before a
 * model call is spent on it.
 */
export const IDENTITY_MAX_ASPECT_RATIO = 1.2;

/** Server-constructed prefix. The raw upload path is never persisted. */
export const IDENTITY_PATH_PREFIX = "identity";

export type NormalizedIdentityUpload = ValidatedImage & { sha256: string };

export type IdentityReferenceRow = {
  id: string;
  storage_path: string;
  width: number;
  height: number;
  validation_status: "pending" | "pass" | "warn" | "fail";
  validation_summary: IdentityReferenceAssessment | Record<string, never>;
  created_at: string;
};

export type ActiveIdentityReference = {
  id: string;
  bucketId: string;
  storagePath: string;
  sha256: string;
  consentVersion: string;
};

/**
 * The single active reference, or null. The database's partial unique index
 * guarantees there is at most one, so this never has to disambiguate.
 */
export async function loadActiveIdentityReference(
  client: SupabaseClient,
  userId: string,
): Promise<ActiveIdentityReference | null> {
  const { data, error } = await client
    .from("profile_identity_references")
    .select("id, bucket_id, storage_path, sha256, consent_version")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.consent_version) return null;

  return {
    id: data.id as string,
    bucketId: data.bucket_id as string,
    storagePath: data.storage_path as string,
    sha256: data.sha256 as string,
    consentVersion: data.consent_version as string,
  };
}

export class IdentityUploadError extends Error {
  constructor(
    readonly code: "unreadable" | "too_wide",
    message: string,
  ) {
    super(message);
    this.name = "IdentityUploadError";
  }
}

/**
 * Validates the *decoded* bytes rather than the claimed extension or MIME
 * type, then re-encodes to a canonical sRGB PNG. `validateAndNormalizeImage`
 * runs `.rotate()` (applying and then discarding the EXIF orientation) and
 * re-encodes through sharp, which is what strips EXIF, GPS, and every other
 * metadata block — a location tag must never survive into storage.
 */
export async function normalizeIdentityUpload(
  bytes: Buffer,
): Promise<ValidatedImage & { sha256: string }> {
  let normalized: ValidatedImage;
  try {
    normalized = await validateAndNormalizeImage(bytes, IDENTITY_IMAGE_LIMITS);
  } catch (error) {
    throw new IdentityUploadError(
      "unreadable",
      error instanceof Error ? error.message : "That file could not be read as an image.",
    );
  }

  if (normalized.width / normalized.height > IDENTITY_MAX_ASPECT_RATIO) {
    throw new IdentityUploadError(
      "too_wide",
      "Use a portrait or square photo that shows you head to toe.",
    );
  }

  return { ...normalized, sha256: sha256Hex(normalized.bytes) };
}

/**
 * Persists the *normalized* bytes at a fully server-constructed path. The raw
 * client-uploaded object is never referenced by the row — its path came from
 * the browser and is only ever used once, to read bytes, before being queued
 * for deletion by the caller.
 */
export async function storeIdentityReference(
  admin: SupabaseClient,
  userId: string,
  normalized: NormalizedIdentityUpload,
  assessment: IdentityReferenceAssessment,
) {
  const environment = getServerEnvironment();
  const bucket = environment.PROFILE_REFERENCES_BUCKET;
  const path = `${userId}/${IDENTITY_PATH_PREFIX}/${randomUUID()}.png`;
  await uploadPrivateObject(admin, bucket, path, userId, normalized.bytes, normalized.mimeType);

  const { data, error } = await admin
    .from("profile_identity_references")
    .insert({
      user_id: userId,
      bucket_id: bucket,
      storage_path: path,
      sha256: normalized.sha256,
      normalized_mime: normalized.mimeType,
      width: normalized.width,
      height: normalized.height,
      validation_status: validationStatusFor(assessment),
      validation_summary: assessment,
    })
    .select("id, storage_path, width, height, validation_status, validation_summary, created_at")
    .single();
  if (error) throw error;
  return data;
}
