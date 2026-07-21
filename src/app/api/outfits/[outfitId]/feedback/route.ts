import { feedbackSchema, outfitParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ outfitId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const input = await parseJson(request, feedbackSchema);
    const supabase = await createClient();
    const { data: outfit, error: outfitError } = await supabase
      .from("outfits")
      .select("id")
      .eq("id", outfitId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(outfitError, "Could not verify the outfit.");
    if (!outfit) throwNotFound("Outfit");

    const { data, error } = await supabase
      .from("outfit_feedback")
      .upsert(
        { ...input, comment: input.comment ?? null, outfit_id: outfitId, user_id: viewer.id },
        { onConflict: "user_id,outfit_id,feedback_type" },
      )
      .select()
      .single();
    throwDatabaseError(error, "Could not save outfit feedback.");
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
