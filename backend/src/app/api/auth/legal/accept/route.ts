import { readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { LEGAL_ACCEPTANCE_PATH } from "@/constants/legal";
import { legalAcceptanceSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/server";
import { authFailure } from "@/lib/auth/auth-error";
import { recordLegalAcceptance } from "@/lib/auth/server";
import { requireLiveUser } from "@/lib/auth/server";
import { safeReturnTo } from "@/lib/auth/redirects";

/**
 * Our own stable code for the operator log. A revoked session, a missing RPC,
 * and a transient outage are deliberately one message to the user, but they
 * need entirely different fixes, so the log says which one happened. Codes
 * only, never a provider message — those can carry account details.
 */
function diagnosticCode(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error && typeof error.cause === "string") return error.cause;
  return "unavailable";
}

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
  } catch (error) {
    console.error("legal_acceptance_failed", { code: diagnosticCode(error) });
    return authRedirect(LEGAL_ACCEPTANCE_PATH, { error: authFailure("unavailable").message });
  }
}
