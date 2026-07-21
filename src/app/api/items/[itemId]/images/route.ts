import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { itemParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { validateAndNormalizeImage } from "@/lib/image/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPrivateSignedUrl, uploadPrivateObject } from "@/lib/storage/private-images";

export const runtime = "nodejs";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_MANUAL_IMAGE_BYTES = 4 * 1024 * 1024;

type Context = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const formData = await request.formData();
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

    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from("wardrobe_items")
      .select("id")
      .eq("id", itemId)
      .eq("user_id", viewer.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, "item_not_found", "Wardrobe item not found.");

    let normalized;
    try {
      normalized = await validateAndNormalizeImage(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      throw new ApiError(
        422,
        "invalid_image",
        error instanceof Error ? error.message : "The image could not be decoded safely.",
      );
    }

    const environment = getServerEnvironment();
    const admin = createAdminClient();
    const imageId = randomUUID();
    const path = `${viewer.id}/${itemId}/original/${imageId}.png`;
    await uploadPrivateObject(
      admin,
      environment.WARDROBE_ITEMS_BUCKET,
      path,
      viewer.id,
      normalized.bytes,
      normalized.mimeType,
    );

    const { count, error: countError } = await admin
      .from("wardrobe_item_images")
      .select("id", { count: "exact", head: true })
      .eq("item_id", itemId)
      .eq("user_id", viewer.id)
      .eq("is_primary", true);
    if (countError) {
      await admin.storage.from(environment.WARDROBE_ITEMS_BUCKET).remove([path]);
      throw countError;
    }
    const row = {
      id: imageId,
      user_id: viewer.id,
      item_id: itemId,
      kind: "original",
      bucket_id: environment.WARDROBE_ITEMS_BUCKET,
      storage_path: path,
      mime_type: normalized.mimeType,
      width: normalized.width,
      height: normalized.height,
      file_size: normalized.bytes.byteLength,
      is_primary: (count ?? 0) === 0,
    };
    let { data, error } = await admin
      .from("wardrobe_item_images")
      .insert(row)
      .select("id, kind, mime_type, width, height, file_size, is_primary, created_at")
      .single();
    if (error?.code === "23505" && row.is_primary) {
      ({ data, error } = await admin
        .from("wardrobe_item_images")
        .insert({ ...row, is_primary: false })
        .select("id, kind, mime_type, width, height, file_size, is_primary, created_at")
        .single());
    }
    if (error || !data) {
      await admin.storage.from(environment.WARDROBE_ITEMS_BUCKET).remove([path]);
      throw error ?? new Error("Image metadata could not be saved.");
    }

    let signedUrl: string | null = null;
    try {
      signedUrl = await createPrivateSignedUrl(
        supabase,
        environment.WARDROBE_ITEMS_BUCKET,
        path,
        viewer.id,
        environment.SIGNED_URL_TTL_SECONDS,
      );
    } catch {
      // The private bytes and metadata are saved; later reads can retry URL signing.
    }
    return NextResponse.json(
      { data: { ...data, signed_url: signedUrl } },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
