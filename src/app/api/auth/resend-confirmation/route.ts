import { rateLimitRedirect, readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { resendConfirmationSchema } from "@/features/auth/schemas";
import { authCallbackUrl } from "@/lib/auth/app-url";
import { recordAuthEvent } from "@/lib/auth/audit";
import { requireCaptchaToken } from "@/lib/auth/captcha";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Always answers the same way. Whether the address is unknown, already
 * confirmed, or genuinely pending, the user sees one message and one
 * destination — otherwise this endpoint would happily enumerate the whole
 * user table for anyone with a word list.
 */
const GENERIC_NOTICE =
  "If that email needs confirming, we have sent a new confirmation link. Check your inbox and spam folder.";

export async function POST(request: Request) {
  const form = await readAuthForm(request, resendConfirmationSchema, "/check-email");
  if (!form.ok) return form.response;

  try {
    await enforceAuthRateLimit(request, "confirmation_resend", { email: form.data.email });
    const captchaToken = requireCaptchaToken(form.data.captchaToken);

    const supabase = await createClient();
    // The result is deliberately not inspected: an "already confirmed" error
    // and a success must be indistinguishable from outside.
    await supabase.auth.resend({
      type: "signup",
      email: form.data.email,
      options: {
        emailRedirectTo: authCallbackUrl("default", "/onboarding"),
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    await recordAuthEvent({ type: "confirmation_requested", result: "success", provider: "email" });
  } catch (error) {
    const throttled = rateLimitRedirect(error, "/check-email");
    if (throttled) return throttled;
    // Any other failure still returns the generic notice, for the same reason.
    console.error("resend_confirmation_failed", { code: "unhandled" });
  }

  return authRedirect("/check-email", { notice: GENERIC_NOTICE });
}
