import { ok, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { throwDatabaseError } from "../../_lib/route";

export async function POST() {
  try {
    await requireViewer();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("export_my_account_data");
    throwDatabaseError(error, "Could not export account data.");
    const date = new Date().toISOString().slice(0, 10);
    return ok(data, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="wardrobe-ai-export-${date}.json"`,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
