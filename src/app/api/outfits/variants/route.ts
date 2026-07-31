import { outfitVariantsRequestSchema } from "@/features/studio/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleOutfitVariants } from "./handler";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The Outfit Studio's request endpoint: three meaningfully different looks
 * (Safe, Fresh, Statement) built only from exact owned, available garments.
 * Makes no image-generation call — the flat lay renders from stored cut-outs.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, outfitVariantsRequestSchema),
      createClient(),
    ]);

    const data = await handleOutfitVariants(supabase, viewer.id, input);
    return ok(data, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
