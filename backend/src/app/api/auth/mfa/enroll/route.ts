import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { ApiError, ok, routeError } from "@/lib/api/response";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireRecentAuthentication, requireSensitiveAction } from "@/lib/auth/server";

/**
 * Begins TOTP enrollment and returns the provisioning material.
 *
 * The factor Supabase creates here is *unverified* and grants nothing: the
 * account's assurance requirements do not change until the user proves they
 * can produce a code. An abandoned enrollment therefore leaves an inert row,
 * which `/api/auth/mfa/unenroll` can clear.
 *
 * The secret and QR code are returned once, to the enrolling user, over the
 * authenticated response — and are never written to our database or logs.
 * After verification there is no path that can read them back out.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;

    const context = await requireSensitiveAction();
    await requireRecentAuthentication(context);

    const { data, error } = await context.supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      issuer: "Wardrobe AI",
    });
    if (error || !data) {
      throw new ApiError(
        400,
        "mfa_enrollment_failed",
        mapAuthError(error, "mfa_enrollment_failed").message,
      );
    }

    return ok(
      {
        factor_id: data.id,
        qr_code: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
