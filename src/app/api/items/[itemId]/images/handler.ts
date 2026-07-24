import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { persistImageRecord } from "./persist-image-record";
import { signImageUrl } from "./sign-image-url";
import { validateUploadedImage } from "./validate-upload";

export async function handleUploadItemImage(
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
