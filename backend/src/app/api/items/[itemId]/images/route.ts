import { NextResponse } from "next/server";

import { itemParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/response";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";
import { validateAndNormalizeImage } from "@/lib/image/validation";
import { randomUUID } from "node:crypto";
import type { ValidatedImage } from "@/lib/image/validation";
import { uploadPrivateObject } from "@/lib/storage/private-images";

type ImageRowAdminClient = ReturnType<typeof createAdminClient>;

async function insertImageRow(
  admin: ImageRowAdminClient,
  environment: ServerEnvironment,
  imageId: string,
  userId: string,
  itemId: string,
  path: string,
  normalized: ValidatedImage,
  isPrimary: boolean,
) {
  const row = {
    id: imageId,
    user_id: userId,
    item_id: itemId,
    kind: "original",
    bucket_id: environment.WARDROBE_ITEMS_BUCKET,
    storage_path: path,
    mime_type: normalized.mimeType,
    width: normalized.width,
    height: normalized.height,
    file_size: normalized.bytes.byteLength,
    is_primary: isPrimary,
  };
  const columns = "id, kind, mime_type, width, height, file_size, is_primary, created_at";
  let { data, error } = await admin
    .from("wardrobe_item_images")
    .insert(row)
    .select(columns)
    .single();
  if (error?.code === "23505" && isPrimary) {
    ({ data, error } = await admin
      .from("wardrobe_item_images")
      .insert({ ...row, is_primary: false })
      .select(columns)
      .single());
  }
  return { data, error };
}

type ImageLookupAdminClient = ReturnType<typeof createAdminClient>;

async function checkIsFirstImage(admin: ImageLookupAdminClient, userId: string, itemId: string) {
  const { count, error } = await admin
    .from("wardrobe_item_images")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .eq("is_primary", true);
  if (error) throw error;
  return (count ?? 0) === 0;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function persistImageRecord(
  admin: AdminClient,
  environment: ServerEnvironment,
  userId: string,
  itemId: string,
  normalized: ValidatedImage,
) {
  const imageId = randomUUID();
  const path = `${userId}/${itemId}/original/${imageId}.png`;
  await uploadPrivateObject(
    admin,
    environment.WARDROBE_ITEMS_BUCKET,
    path,
    userId,
    normalized.bytes,
    normalized.mimeType,
  );

  const rollback = () => admin.storage.from(environment.WARDROBE_ITEMS_BUCKET).remove([path]);

  const isFirstImage = await checkIsFirstImage(admin, userId, itemId).catch(async (error) => {
    await rollback();
    throw error;
  });

  const { data, error } = await insertImageRow(
    admin,
    environment,
    imageId,
    userId,
    itemId,
    path,
    normalized,
    isFirstImage,
  );
  if (error || !data) {
    await rollback();
    throw error ?? new Error("Image metadata could not be saved.");
  }

  return { data, path };
}

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_MANUAL_IMAGE_BYTES = 4 * 1024 * 1024;

async function validateUploadedImage(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || !ACCEPTED_TYPES.has(file.type)) {
    throw new ApiError(422, "invalid_image", "Choose a JPEG, PNG, or WebP wardrobe image.");
  }
  if (file.size > MAX_MANUAL_IMAGE_BYTES) {
    throw new ApiError(
      413,
      "image_too_large",
      "Manual images must be 4 MB or smaller. Use photo import for larger images.",
    );
  }

  try {
    return await validateAndNormalizeImage(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    throw new ApiError(
      422,
      "invalid_image",
      error instanceof Error ? error.message : "The image could not be decoded safely.",
    );
  }
}

async function signImageUrl(
  supabase: SupabaseClient,
  environment: ServerEnvironment,
  path: string,
  userId: string,
): Promise<string | null> {
  try {
    return await createPrivateSignedUrl(
      supabase,
      environment.WARDROBE_ITEMS_BUCKET,
      path,
      userId,
      environment.SIGNED_URL_TTL_SECONDS,
    );
  } catch {
    // The private bytes and metadata are saved; later reads can retry URL signing.
    return null;
  }
}

async function handleUploadItemImage(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  formData: FormData,
) {
  const normalized = await validateUploadedImage(formData);

  const { data: item, error: itemError } = await supabase
    .from("wardrobe_items")
    .select("id")
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new ApiError(404, "item_not_found", "Wardrobe item not found.");

  const environment = getServerEnvironment();
  const admin = createAdminClient();
  const { data, path } = await persistImageRecord(admin, environment, userId, itemId, normalized);
  const signedUrl = await signImageUrl(supabase, environment, path, userId);

  return { ...data, signed_url: signedUrl };
}

export const runtime = "nodejs";

type Context = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const formData = await request.formData();
    const supabase = await createClient();

    const data = await handleUploadItemImage(supabase, viewer.id, itemId, formData);
    return NextResponse.json(
      { data },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
