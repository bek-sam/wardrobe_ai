import { z } from "zod";

import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleListCutouts } from "./handler";

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
