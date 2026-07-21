import { NextResponse } from "next/server";
import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const [{ jobId, candidateId }, viewer] = await Promise.all([context.params, requireViewer()]);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("import_job_candidates")
      .update({ status: "review_metadata" })
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .eq("status", "review_cutout")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new ApiError(409, "invalid_candidate_state", "The cutout is not awaiting approval.");
    return NextResponse.json({ data });
  } catch (error) {
    return routeError(error);
  }
}
