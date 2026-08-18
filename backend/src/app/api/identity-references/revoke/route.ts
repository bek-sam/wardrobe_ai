import { z } from "zod";

import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const revokeSchema = z.object({ deleteAssets: z.boolean().default(true) }).strict();

/**
 * Revoking consent blocks every future generation immediately and, by default,
 * queues the reference photo and every generated try-on for deletion. The user
 * can opt to keep the images by sending `deleteAssets: false`.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, revokeSchema),
      createClient(),
    ]);
    void viewer;

    const { data, error } = await supabase.rpc("revoke_identity_reference", {
      p_delete_assets: input.deleteAssets,
    });
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
