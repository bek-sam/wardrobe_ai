import type { AdminClient, CandidateMemberRow, OutfitPreviewJobRow } from "./contracts";

export async function loadActiveCandidateMembers(
  admin: AdminClient,
  job: OutfitPreviewJobRow,
): Promise<CandidateMemberRow[] | null> {
  const { data: candidate } = await admin
    .from("outfit_candidates")
    .select("id, status, outfit_candidate_items(item_id, role, sort_order)")
    .eq("id", job.candidate_id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  const memberRows = ((candidate?.outfit_candidate_items ?? []) as CandidateMemberRow[])
    .slice()
    .sort((first, second) => first.sort_order - second.sort_order);
  if (!candidate || candidate.status !== "active" || memberRows.length === 0) {
    await admin.from("outfit_preview_jobs").update({ status: "superseded" }).eq("id", job.id);
    return null;
  }
  return memberRows;
}
