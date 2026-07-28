import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { LEGAL_ACCEPTANCE_PATH } from "@/constants/legal";
import { legalAcceptanceSchema } from "@/features/auth/schemas";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authFailure } from "@/lib/auth/auth-error";
import { recordLegalAcceptance } from "@/lib/auth/legal";
import { requireLiveUser } from "@/lib/auth/live-user";
import { safeReturnTo } from "@/lib/auth/redirects";

/**
 * Records acceptance for a user who arrived without one: a Google signup, an
 * account created directly in Supabase, or an existing account after the
 * documents were versioned up.
 *
 * The record is written server-side against the live user. Client-set metadata
 * is never treated as evidence of consent — a user can write their own
 * metadata, which would make the record an assertion by the very party it is
 * meant to bind.
 */
export async function POST(request: Request) {
  const form = await readAuthForm(request, legalAcceptanceSchema, LEGAL_ACCEPTANCE_PATH);
  if (!form.ok) return form.response;

  try {
    const { user } = await requireLiveUser();
    await recordLegalAcceptance(user.id, "in_app_reacceptance");
    await recordAuthEvent({ type: "legal_accepted", result: "success", userId: user.id });
    return authRedirect(safeReturnTo(form.data.returnTo));
  } catch {
    console.error("legal_acceptance_failed", { code: "unavailable" });
    return authRedirect(LEGAL_ACCEPTANCE_PATH, { error: authFailure("unavailable").message });
  }
}
