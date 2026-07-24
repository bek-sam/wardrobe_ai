import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";

// Priority rule 4 ("user_selected"): the only client-facing entry point into
// the modeled preview pipeline. Consent, rate limiting, and freshness/dedup
// are all enforced inside request_outfit_preview()/enqueue_outfit_preview_job()
// -- this route never generates an image itself, only enqueues a job.
export async function handleRequestPreview(supabase: SupabaseClient, candidateId: string) {
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
