import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { profileUpdateSchema } from "../_lib/schemas";
import { throwDatabaseError, throwNotFound } from "../_lib/route";

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", viewer.id)
      .maybeSingle();
    throwDatabaseError(error, "Could not load the profile.");
    if (!data) throwNotFound("Profile");
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const viewer = await requireViewer();
    const input = await parseJson(request, profileUpdateSchema);
    if (input.avatar_path && !input.avatar_path.startsWith(`${viewer.id}/`)) {
      throw new ApiError(
        422,
        "validation_failed",
        "The avatar path must belong to the authenticated user.",
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(input)
      .eq("id", viewer.id)
      .select()
      .maybeSingle();
    throwDatabaseError(error, "Could not update the profile.");
    if (!data) throwNotFound("Profile");
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
