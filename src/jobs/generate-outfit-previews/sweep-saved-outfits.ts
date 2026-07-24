import { matchOutfitToCandidateAndEnqueue } from "./match-outfit-to-candidate";
import type { AdminClient, ServerEnvironment } from "./types";

export async function sweepSavedOutfits(admin: AdminClient, environment: ServerEnvironment) {
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1_000).toISOString();
  const { data: savedOutfits } = await admin
    .from("outfits")
    .select("id, user_id")
    .eq("source", "user")
    .gte("created_at", since)
    .limit(200);
  for (const outfit of savedOutfits ?? []) {
    await matchOutfitToCandidateAndEnqueue(
      admin,
      outfit.user_id as string,
      outfit.id as string,
      "user_saved",
      environment,
    ).catch(() => {});
  }
}
