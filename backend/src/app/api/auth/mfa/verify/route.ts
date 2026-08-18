import { mfaEnrollVerifySchema } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { recordAuthEvent } from "@/lib/auth/server";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireLiveUser } from "@/lib/auth/server";
import { enforceAuthRateLimit } from "@/lib/auth/server";

/**
 * Verifies a TOTP code, for both meanings of "verify": confirming a brand-new
 * factor, and satisfying the challenge at sign-in.
 *
 * This route must **not** require AAL2. It is the route a user reaches
 * precisely because they are still at AAL1 — demanding the second factor here
 * would make the second factor unreachable.
 *
 * `challengeAndVerify` issues the challenge and redeems it in one call, so the
 * challenge id never travels through a URL or a form field.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const input = await parseJson(request, mfaEnrollVerifySchema);
    const { supabase, user } = await requireLiveUser();
    // Bounded independently of Supabase's own limits: six digits is a small
    // space, and unbounded retries would make it a smaller one.
    await enforceAuthRateLimit(request, "reauthentication", { userId: user.id });

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.code,
    });
    if (error) {
      await recordAuthEvent({ type: "mfa_challenged", result: "failure", userId: user.id });
      throw new ApiError(400, "mfa_invalid_code", mapAuthError(error, "mfa_invalid_code").message);
    }

    await recordAuthEvent({ type: "mfa_challenged", result: "success", userId: user.id });
    return ok({ verified: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
