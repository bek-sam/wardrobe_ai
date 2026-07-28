import { rateLimitRedirect, readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { signupSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/response";
import { authFailure } from "@/lib/auth/auth-error";
import { getAuthFlags } from "@/lib/auth/flags";

import { handleSignup } from "./handler";

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
