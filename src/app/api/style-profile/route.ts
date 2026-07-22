import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { styleProfileUpdateSchema } from "../_lib/schemas";
import { throwDatabaseError } from "../_lib/route";

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("style_profiles")
      .select("*")
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(error, "Could not load the style profile.");
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, styleProfileUpdateSchema);
    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase
      .from("style_profiles")
      .select("*")
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(readError, "Could not load the style profile.");

    const runsCold = input.runs_cold === undefined ? existing?.runs_cold : input.runs_cold;
    const runsHot = input.runs_hot === undefined ? existing?.runs_hot : input.runs_hot;
    if (runsCold === true && runsHot === true) {
      throw new ApiError(422, "validation_failed", "runs_cold and runs_hot cannot both be true.");
    }

    if (existing) {
      const { data, error } = await supabase
        .from("style_profiles")
        .update(input)
        .eq("user_id", viewer.id)
        .select()
        .single();
      throwDatabaseError(error, "Could not update the style profile.");
      return ok(data);
    }

    const { data, error } = await supabase
      .from("style_profiles")
      .insert({ ...input, user_id: viewer.id })
      .select()
      .single();
    throwDatabaseError(error, "Could not create the style profile.");
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
