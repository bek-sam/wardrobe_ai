import type { NextResponse } from "next/server";
import type { z } from "zod";

import { authRedirect } from "@/app/api/auth/_lib/redirect";
import type { loginSchema } from "@/features/auth/schemas";
import { recordAuthEvent } from "@/lib/auth/audit";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireCaptchaToken } from "@/lib/auth/captcha";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { safeReturnTo } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

import { destinationAfterFirstFactor } from "./destination";

export async function handleLogin(
  request: Request,
  input: z.infer<typeof loginSchema>,
): Promise<NextResponse> {
  // Both limits are charged against the submitted address and the client IP
  // before Supabase sees a password, so credential stuffing is stopped here
  // rather than by the provider's project-wide ceiling.
  await enforceAuthRateLimit(request, "login", { email: input.email });
  const captchaToken = requireCaptchaToken(input.captchaToken);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) {
    await recordAuthEvent({ type: "login_attempted", result: "failure", provider: "email" });
    // Falls back to `invalid_credentials` rather than a generic failure so an
    // unmapped provider error cannot become a signal that distinguishes a
    // registered address from an unregistered one.
    return authRedirect("/login", { error: mapAuthError(error, "invalid_credentials").message });
  }

  await recordAuthEvent({ type: "login_attempted", result: "success", provider: "email" });
  return authRedirect(await destinationAfterFirstFactor(supabase, safeReturnTo(input.returnTo)));
}
