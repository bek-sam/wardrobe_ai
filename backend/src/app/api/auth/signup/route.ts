import { rateLimitRedirect, readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { signupSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/response";
import { authFailure } from "@/lib/auth/auth-error";
import { getAuthFlags } from "@/lib/auth/server";
import type { NextResponse } from "next/server";
import type { z } from "zod";
import { destinationAfterFirstFactor } from "@/app/api/auth/login/destination";
import { authCallbackUrl } from "@/lib/auth/server";
import { recordAuthEvent } from "@/lib/auth/server";
import { mapAuthError } from "@/lib/auth/auth-error";
import { requireCaptchaToken } from "@/lib/auth/server";
import { recordLegalAcceptance } from "@/lib/auth/server";
import { enforceAuthRateLimit } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

async function handleSignup(
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

export async function POST(request: Request) {
  const form = await readAuthForm(request, signupSchema, "/signup");
  if (!form.ok) return form.response;

  // Enforced on the server, not by a disabled button: a client can post this
  // form directly, so the flag has to be checked where the account would
  // actually be created.
  if (!getAuthFlags().publicSignupEnabled) {
    return authRedirect("/signup", { error: authFailure("signup_disabled").message });
  }

  try {
    return await handleSignup(request, form.data);
  } catch (error) {
    const throttled = rateLimitRedirect(error, "/signup");
    if (throttled) return throttled;
    if (error instanceof ApiError && error.code === "captcha_required") {
      return authRedirect("/signup", { error: authFailure("captcha_required").message });
    }
    console.error("signup_route_failed", { code: "unhandled" });
    return authRedirect("/signup", { error: authFailure("unavailable").message });
  }
}
