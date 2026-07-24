import { saveGeneratedOutfitRequestSchema } from "@/features/stylist/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleSaveGeneratedOutfit } from "./handler";

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, saveGeneratedOutfitRequestSchema),
      createClient(),
    ]);

    const data = await handleSaveGeneratedOutfit(supabase, viewer.id, input.generationId);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
