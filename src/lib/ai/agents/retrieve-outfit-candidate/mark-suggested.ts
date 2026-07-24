import { createAdminClient } from "@/lib/supabase/admin";

export async function markOutfitCandidateSuggested(userId: string, candidateId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("increment_outfit_candidate_exposure", {
    p_candidate_id: candidateId,
    p_user_id: userId,
  });
  if (error) throw error;
}
