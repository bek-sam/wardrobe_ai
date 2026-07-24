import type { SupabaseClient } from "@supabase/supabase-js";

import type { ServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

export async function signImageUrl(
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
