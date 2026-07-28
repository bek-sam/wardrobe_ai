import { ApiError } from "@/lib/api/response";

import { getAuthFlags } from "./flags";

/**
 * Checks that a CAPTCHA token is present and hands it back for the caller to
 * pass straight to Supabase.
 *
 * The token is **not** verified here. A Turnstile token is single-use, so
 * calling `siteverify` ourselves would burn it and Supabase's own check —
 * which is the one that actually gates the auth operation — would then fail
 * for every legitimate user. Supabase holds the secret and does the
 * verification; our job is to refuse to proceed without a token at all, so a
 * client that simply omits the field cannot skip the challenge.
 *
 * Returns `undefined` when CAPTCHA is off, which is exactly what the Supabase
 * `captchaToken` option expects for "not applicable".
 */
export function requireCaptchaToken(token: string | undefined): string | undefined {
  if (!getAuthFlags().captchaEnabled) return undefined;

  const trimmed = token?.trim();
  if (!trimmed) {
    throw new ApiError(
      400,
      "captcha_required",
      "Complete the verification challenge and try again.",
    );
  }
  return trimmed;
}
