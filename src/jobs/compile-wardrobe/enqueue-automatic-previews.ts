import type { AdminClient, ServerEnvironment } from "./types";

// Best-effort auto-preview enqueue (Rule 1: top 3-5 candidates featuring a
// newly added garment). Gated on modeled_preview_consent; never throws.
export async function enqueueAutomaticPreviewJobs(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  createdItemIds: ReadonlySet<string>,
  compiledWardrobeVersion: string,
) {
  if (createdItemIds.size === 0) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("modeled_preview_consent")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.modeled_preview_consent) return;

  const { data: memberRows } = await admin
    .from("outfit_candidate_items")
    .select("candidate_id")
    .eq("user_id", userId)
    .in("item_id", [...createdItemIds]);
  const candidateIds = [...new Set((memberRows ?? []).map((row) => row.candidate_id as string))];
  if (candidateIds.length === 0) return;

  const { data: candidateRows } = await admin
    .from("outfit_candidates")
    .select("id, preview_status")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("compiled_wardrobe_version", compiledWardrobeVersion)
    .in("id", candidateIds)
    .order("total_score", { ascending: false })
    .limit(environment.PREVIEW_MAX_AUTO_PER_UPLOAD);

  await Promise.all(
    (candidateRows ?? [])
      .filter((row) => row.preview_status !== "ready")
      .map((row) =>
        admin
          .rpc("enqueue_outfit_preview_job", {
            p_user_id: userId,
            p_candidate_id: row.id,
            p_priority_reason: "new_item",
            p_max_queued_per_user: environment.PREVIEW_MAX_QUEUED_PER_USER,
          })
          .then(
            () => undefined,
            () => undefined,
          ),
      ),
  );
}
