import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ok, routeError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/audit";
import { requireSensitiveAction } from "@/lib/auth/sensitive-action";

import { buildAccountExport } from "./build-export";

/**
 * An export is every private thing the account holds in one file, so it is
 * treated as a sensitive action: a live `getUser()` rather than local claims,
 * and AAL2 when the account has a factor enrolled.
 *
 * `no-store` matters more here than anywhere else — this response body is the
 * user's entire wardrobe, sizes, location, and history.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const { supabase, user } = await requireSensitiveAction();
    const data = await buildAccountExport(supabase, user);
    await recordAuthEvent({ type: "account_export", result: "success", userId: user.id });

    const date = new Date().toISOString().slice(0, 10);
    return ok(data, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="wardrobe-ai-export-${date}.json"`,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
