import { NextResponse } from "next/server";

import { ok, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { compileWardrobeForUser } from "@/jobs/compile-wardrobe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wardrobe_compilation_state")
      .select("dirty_since, last_compiled_at, candidate_count, compiled_wardrobe_version")
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (error) throw error;
    return ok(
      data ?? {
        dirty_since: null,
        last_compiled_at: null,
        candidate_count: 0,
        compiled_wardrobe_version: null,
      },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_next_own_wardrobe_compilation_job", {
      p_lease_seconds: 300,
    });
    if (error) throw error;
    const claimed = Array.isArray(data) ? data[0] : data;
    const jobId = claimed && typeof claimed === "object" && "id" in claimed ? claimed.id : null;
    if (typeof jobId !== "string") {
      return new NextResponse(null, { status: 204 });
    }

    const result = await compileWardrobeForUser(viewer.id, jobId);
    return ok(result, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
