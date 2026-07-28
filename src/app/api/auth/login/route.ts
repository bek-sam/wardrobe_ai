import { rateLimitRedirect, readAuthForm } from "@/app/api/auth/_lib/form-route";
import { authRedirect } from "@/app/api/auth/_lib/redirect";
import { loginSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/response";
import { authFailure } from "@/lib/auth/auth-error";

import { handleLogin } from "./handler";

export async function POST(request: Request) {
  const form = await readAuthForm(request, loginSchema, "/login");
  if (!form.ok) return form.response;

  try {
    return await handleLogin(request, form.data);
  } catch (error) {
    const throttled = rateLimitRedirect(error, "/login");
    if (throttled) return throttled;
    if (error instanceof ApiError && error.code === "captcha_required") {
      return authRedirect("/login", { error: authFailure("captcha_required").message });
    }
    // Code only: an exception here can carry the submitted address.
    console.error("login_route_failed", { code: "unhandled" });
    return authRedirect("/login", { error: authFailure("unavailable").message });
  }
}
