import type { AdminClient } from "./types";

export async function discardUnpublishedVersion(
  admin: AdminClient,
  userId: string,
  compiledWardrobeVersion: string,
) {
  // Best-effort cleanup of a version that failed before finalize() could
  // publish it. Never referenced by wardrobe_compilation_state, so leaving it
  // behind would only ever waste space, not serve stale/wrong data -- but
  // clean it up anyway so failed attempts don't accumulate.
  await admin
    .from("outfit_candidates")
    .delete()
    .eq("user_id", userId)
    .eq("compiled_wardrobe_version", compiledWardrobeVersion);
}
