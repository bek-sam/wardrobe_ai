import type { NextResponse } from "next/server";
import type { z } from "zod";

import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { destinationAfterFirstFactor } from "@/app/api/auth/login/destination";
import type { signupSchema } from "@/features/auth/schemas";
import { authCallbackUrl } from "@/lib/auth/app-url";
import { recordAuthEvent } from "@/lib/auth/audit";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireCaptchaToken } from "@/lib/auth/captcha";
import { recordLegalAcceptance } from "@/lib/auth/legal";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function handleSignup(
  request: Request,
  input: z.infer<typeof signupSchema>,
): Promise<NextResponse> {
  await enforceAuthRateLimit(request, "signup", { email: input.email });
  const captchaToken = requireCaptchaToken(input.captchaToken);

  const supabase = await createClient();
  // `passwordConfirmation` is checked by the schema and stops here — only the
  // password itself is ever sent to the provider.
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authCallbackUrl("default", "/onboarding"),
      data: { first_name: input.firstName },
      ...(captchaToken ? { captchaToken } : {}),
    },
  });

  if (error || !data.user) {
    await recordAuthEvent({ type: "signup_requested", result: "failure", provider: "email" });
    return authRedirect("/signup", { error: mapAuthError(error).message });
  }

  // Supabase answers a signup for an address that already exists with a
  // decoy user carrying no identities, so the response is indistinguishable
  // from a real one. Writing an acceptance record for that decoy would fail
  // (no such profile) and, worse, a difference in behaviour would turn this
  // route into an account-existence oracle. Treat it as an ordinary success.
  if ((data.user.identities?.length ?? 0) > 0) {
    await recordLegalAcceptance(data.user.id, "signup");
  }
  await recordAuthEvent({ type: "signup_requested", result: "success", provider: "email" });

  if (!data.session) return authRedirect("/check-email");
  return authRedirect(await destinationAfterFirstFactor(supabase, "/onboarding"));
}
