import { markOutfitCandidateSuggested } from "@/lib/ai/agents/retrieve-outfit-candidate";
import { createAdminClient } from "@/lib/supabase/admin";

import type { TryServeRetrievedOutfitInput } from "./types";

// Best-effort: queue a modeled preview for next time if this served candidate
// doesn't have one yet and the user has consented. Never runs the preview
// pipeline synchronously and never blocks the response returned to the caller.
export function scheduleRetrievedOutfitFollowUp({
  input,
  profile,
  retrieved,
}: Pick<TryServeRetrievedOutfitInput, "input" | "profile" | "retrieved">) {
  return Promise.all([
    markOutfitCandidateSuggested(input.userId, retrieved.candidateId).catch(() => {
      // Exposure tracking is a non-critical optimization; never surface this.
    }),
    profile?.modeled_preview_consent && retrieved.previewStatus !== "ready"
      ? createAdminClient()
          .rpc("enqueue_outfit_preview_job", {
            p_user_id: input.userId,
            p_candidate_id: retrieved.candidateId,
            p_priority_reason: "frequently_suggested",
          })
          .then(
            () => undefined,
            () => undefined,
          )
      : Promise.resolve(),
  ]);
}
