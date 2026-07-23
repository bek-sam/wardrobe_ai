import { outfitCandidateParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ApiError, ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ candidateId: string }> };

// Signed URLs are short-lived and must never be persisted (see
// retrieveStoredOutfitCandidates), so any caller that wants to actually
// display a ready preview image -- live or from stylist chat history --
// fetches a fresh one here instead of storing one.
export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { candidateId } = await parseRouteParams(context.params, outfitCandidateParamsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("outfit_candidates")
      .select("preview_status, preview_bucket, preview_storage_path")
      .eq("id", candidateId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(error, "Could not load the outfit candidate.");
    if (!data) throwNotFound("Outfit candidate");

    if (data.preview_status !== "ready" || !data.preview_bucket || !data.preview_storage_path) {
      return ok({ status: data.preview_status, previewUrl: null });
    }

    const environment = getServerEnvironment();
    const previewUrl = await createPrivateSignedUrl(
      supabase,
      data.preview_bucket,
      data.preview_storage_path,
      viewer.id,
      environment.SIGNED_URL_TTL_SECONDS,
    );
    return ok(
      { status: "ready" as const, previewUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

// Priority rule 4 ("user_selected"): the only client-facing entry point into
// the modeled preview pipeline. Consent, rate limiting, and freshness/dedup
// are all enforced inside request_outfit_preview()/enqueue_outfit_preview_job()
// -- this route never generates an image itself, only enqueues a job.
export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const { candidateId } = await parseRouteParams(context.params, outfitCandidateParamsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_outfit_preview", {
      p_candidate_id: candidateId,
    });
    if (error?.code === "PT429") {
      throw new ApiError(
        429,
        "preview_rate_limited",
        "Too many preview requests. Try again later.",
      );
    }
    if (error?.code === "42501") {
      throw new ApiError(
        403,
        "consent_required",
        "Modeled preview consent is required before requesting a preview.",
      );
    }
    if (error?.code === "PT404") {
      throw new ApiError(404, "not_found", "The requested outfit candidate was not found.");
    }
    throwDatabaseError(error, "Could not request a modeled preview.");
    return ok(data, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
