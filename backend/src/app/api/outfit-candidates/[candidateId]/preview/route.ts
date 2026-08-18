import { outfitCandidateParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDatabaseError } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";
import { throwNotFound } from "@/app/api/_lib/route";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

// Signed URLs are short-lived and must never be persisted (see
// retrieveStoredOutfitCandidates), so any caller that wants to actually
// display a ready preview image -- live or from stylist chat history --
// fetches a fresh one here instead of storing one.
async function handleGetPreview(supabase: SupabaseClient, userId: string, candidateId: string) {
  const { data, error } = await supabase
    .from("outfit_candidates")
    .select("preview_status, preview_bucket, preview_storage_path")
    .eq("id", candidateId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the outfit candidate.");
  if (!data) throwNotFound("Outfit candidate");

  if (data.preview_status !== "ready" || !data.preview_bucket || !data.preview_storage_path) {
    return { status: data.preview_status, previewUrl: null };
  }

  const environment = getServerEnvironment();
  const previewUrl = await createPrivateSignedUrl(
    supabase,
    data.preview_bucket,
    data.preview_storage_path,
    userId,
    environment.SIGNED_URL_TTL_SECONDS,
  );
  return { status: "ready" as const, previewUrl };
}

// Priority rule 4 ("user_selected"): the only client-facing entry point into
// the modeled preview pipeline. Consent, rate limiting, and freshness/dedup
// are all enforced inside request_outfit_preview()/enqueue_outfit_preview_job()
// -- this route never generates an image itself, only enqueues a job.
async function handleRequestPreview(supabase: SupabaseClient, candidateId: string) {
  const { data, error } = await supabase.rpc("request_outfit_preview", {
    p_candidate_id: candidateId,
  });
  if (error?.code === "PT429") {
    throw new ApiError(429, "preview_rate_limited", "Too many preview requests. Try again later.");
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
  return data;
}

type Context = { params: Promise<{ candidateId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { candidateId } = await parseRouteParams(context.params, outfitCandidateParamsSchema);
    const supabase = await createClient();
    const data = await handleGetPreview(supabase, viewer.id, candidateId);
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const { candidateId } = await parseRouteParams(context.params, outfitCandidateParamsSchema);
    const supabase = await createClient();
    const data = await handleRequestPreview(supabase, candidateId);
    return ok(data, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
