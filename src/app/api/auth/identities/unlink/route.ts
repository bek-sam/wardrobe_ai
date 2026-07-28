import { z } from "zod";

import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/audit";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireRecentAuthentication, requireSensitiveAction } from "@/lib/auth/sensitive-action";
import { canUnlinkIdentity } from "@/lib/auth/unlink-guard";
import { normalizeIdentities } from "@/lib/auth/identities";

import { UNLINK_REFUSALS } from "./refusals.data";

const unlinkSchema = z.object({ identityId: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, unlinkSchema);
    const context = await requireSensitiveAction();
    await requireRecentAuthentication(context);

    // Read live rather than from the cached user: the set of identities is
    // exactly what the last-identity rule depends on.
    const { data, error: listError } = await context.supabase.auth.getUserIdentities();
    if (listError || !data) throw new ApiError(400, "identity_lookup_failed", "Try again.");

    const decision = canUnlinkIdentity(normalizeIdentities(data.identities), input.identityId);
    if (!decision.allowed) {
      const refusal = UNLINK_REFUSALS[decision.reason];
      throw new ApiError(refusal.status, decision.reason, refusal.message);
    }

    // Passed by object, and only after we matched it in the caller's own
    // identity list, so a foreign identity id can never reach this call.
    const target = data.identities.find((item) => item.identity_id === input.identityId)!;
    const { error } = await context.supabase.auth.unlinkIdentity(target);
    if (error) throw new ApiError(400, "identity_unlink_failed", mapAuthError(error).message);

    await recordAuthEvent({
      type: "identity_unlinked",
      result: "success",
      userId: context.user.id,
    });
    return ok({ unlinked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
