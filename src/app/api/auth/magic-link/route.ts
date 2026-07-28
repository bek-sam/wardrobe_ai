import { rateLimitRedirect, readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { magicLinkSchema } from "@/features/auth/schemas";
import { authCallbackUrl } from "@/lib/auth/app-url";
import { recordAuthEvent } from "@/lib/auth/audit";
import { authFailure } from "@/lib/auth/auth-error";
import { requireCaptchaToken } from "@/lib/auth/captcha";
import { getAuthFlags } from "@/lib/auth/flags";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { safeReturnTo } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

const GENERIC_NOTICE =
  "If an eligible account exists for that email, a sign-in link is on its way. The link expires shortly.";

export async function POST(request: Request) {
  const form = await readAuthForm(request, magicLinkSchema, "/magic-link");
  if (!form.ok) return form.response;

  if (!getAuthFlags().magicLinkEnabled) {
    return authRedirect("/login", { error: authFailure("provider_disabled").message });
  }

  try {
    await enforceAuthRateLimit(request, "magic_link", { email: form.data.email });
    const captchaToken = requireCaptchaToken(form.data.captchaToken);

    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email: form.data.email,
      options: {
        // Existing users only. Without this, "sign in with a link" quietly
        // becomes a second signup path that bypasses the signup flag, the
        // Terms checkbox, and the legal acceptance record.
        shouldCreateUser: false,
        emailRedirectTo: authCallbackUrl("magicLink", safeReturnTo(form.data.returnTo)),
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    await recordAuthEvent({ type: "magic_link_requested", result: "success", provider: "email" });
  } catch (error) {
    const throttled = rateLimitRedirect(error, "/magic-link");
    if (throttled) return throttled;
    console.error("magic_link_failed", { code: "unhandled" });
  }

  return authRedirect("/check-email", { notice: GENERIC_NOTICE });
}
