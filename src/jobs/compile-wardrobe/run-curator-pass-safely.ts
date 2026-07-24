import type { PreferenceContext } from "./load-preference-context";
import { runCuratorPass } from "./run-curator-pass";
import type { AdminClient, ChangeEventSummary, ServerEnvironment } from "./types";

// Curator failure never blocks compilation: rows simply stay
// curator_status='not_reviewed' and the deterministic
// generated_by='compilation' library remains fully usable. The next
// compile's catch-up shortlist retries them automatically.
export async function runCuratorPassSafely(
  admin: AdminClient,
  userId: string,
  environment: ServerEnvironment,
  preferences: PreferenceContext,
  compiledWardrobeVersion: string,
  changeEvents: ChangeEventSummary,
): Promise<number> {
  try {
    const result = await runCuratorPass(
      admin,
      userId,
      environment,
      preferences,
      compiledWardrobeVersion,
      changeEvents.affectedItemIds,
      changeEvents.createdItemIds,
    );
    return result.calls;
  } catch {
    return 0;
  }
}
