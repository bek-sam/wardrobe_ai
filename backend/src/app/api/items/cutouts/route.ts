import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";
import { createClient } from "@/lib/supabase/server";

/**
 * Short-lived signed cut-out URLs for a bounded set of owned items — what the
 * flat lay renders from. Reads through the caller's own RLS-bound client, so
 * an item id belonging to someone else simply returns nothing rather than
 * needing a separate ownership branch.
 */
async function handleListCutouts(
  supabase: SupabaseClient,
  userId: string,
  itemIds: readonly string[],
) {
  const environment = getServerEnvironment();
  const { data, error } = await supabase
    .from("wardrobe_item_images")
    .select("item_id, bucket_id, storage_path, is_primary, created_at")
    .eq("user_id", userId)
    .eq("kind", "cutout")
    .in("item_id", [...new Set(itemIds)])
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const best = new Map<string, { bucket_id: string; storage_path: string }>();
  for (const row of data ?? []) {
    const itemId = row.item_id as string;
    if (!best.has(itemId)) {
      best.set(itemId, {
        bucket_id: row.bucket_id as string,
        storage_path: row.storage_path as string,
      });
    }
  }

  const cutouts = await Promise.all(
    [...best.entries()].map(async ([itemId, row]) => ({
      itemId,
      url: await createPrivateSignedUrl(
        supabase,
        row.bucket_id,
        row.storage_path,
        userId,
        environment.SIGNED_URL_TTL_SECONDS,
      ).catch(() => null),
    })),
  );

  return { cutouts: cutouts.filter((entry) => entry.url !== null) };
}

// POST rather than GET: the id list is bounded but long, and the response
// carries signed URLs that must not sit in a shareable URL or any cache.
const cutoutsRequestSchema = z
  .object({ itemIds: z.array(z.string().uuid()).min(1).max(24) })
  .strict();

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, cutoutsRequestSchema),
      createClient(),
    ]);

    const data = await handleListCutouts(supabase, viewer.id, input.itemIds);
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
