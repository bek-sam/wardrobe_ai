import { rateLimitRedirect, readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { authCallbackUrl } from "@/lib/auth/app-url";
import { recordAuthEvent } from "@/lib/auth/audit";
import { requireCaptchaToken } from "@/lib/auth/captcha";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createClient } from "@/lib/supabase/server";

const GENERIC_NOTICE =
  "If an account exists for that email, a password reset link is on its way. The link expires shortly.";

export async function POST(request: Request) {
  const form = await readAuthForm(request, forgotPasswordSchema, "/forgot-password");
  if (!form.ok) return form.response;

  try {
    await enforceAuthRateLimit(request, "password_recovery", { email: form.data.email });
    const captchaToken = requireCaptchaToken(form.data.captchaToken);

    const supabase = await createClient();
    // Sent to the dedicated recovery callback, never to Settings. That
    // callback is the only place that mints a password-reset challenge, so an
    // ordinary confirmation link can never be redeemed for one.
    await supabase.auth.resetPasswordForEmail(form.data.email, {
      redirectTo: authCallbackUrl("recovery"),
      ...(captchaToken ? { captchaToken } : {}),
    });
    await recordAuthEvent({ type: "recovery_requested", result: "success", provider: "email" });
  } catch (error) {
    const throttled = rateLimitRedirect(error, "/forgot-password");
    if (throttled) return throttled;
    console.error("forgot_password_failed", { code: "unhandled" });
  }

  // Same response on every path, including a rejected CAPTCHA-less submit, so
  // response shape never reveals whether the address is registered.
  return authRedirect("/check-email", { notice: GENERIC_NOTICE });
}
