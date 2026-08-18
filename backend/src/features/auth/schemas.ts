import { z } from "zod";

import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  RETURN_TO_MAX_LENGTH,
} from "@/lib/auth/constants";

/**
 * Passwords are measured in Unicode code points so an emoji counts as the one
 * character the user typed, and are never trimmed, lowercased, or normalized:
 * the exact bytes entered are the bytes verified. A leading or trailing space
 * from a password manager is part of the secret.
 */
const codePointLength = (value: string) => [...value].length;

export const passwordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`)
  .refine(
    (value) => codePointLength(value) >= PASSWORD_MIN_LENGTH,
    `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  );

/**
 * Existing accounts may predate the current minimum, so signing in only
 * requires a non-empty value. Applying the new policy here would lock those
 * users out of the very flow they need to change their password.
 */
export const existingPasswordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);

/** Only surrounding whitespace is removed; the address itself is untouched. */
export const emailSchema = z.string().trim().pipe(z.email().max(EMAIL_MAX_LENGTH));

export const returnToSchema = z.string().max(RETURN_TO_MAX_LENGTH).optional();

/** Present only when CAPTCHA is enabled; emptiness is enforced by the route. */
export const captchaTokenSchema = z.string().max(4096).optional();

/** A TOTP code is exactly six digits; anything else never reaches the provider. */
export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the six-digit code from your authenticator app.");

/**
 * The confirmation field never reaches the provider; it exists so a typo in a
 * password the user cannot see does not become a password they cannot use.
 * Compared here as well as in the browser, since the browser check is a
 * convenience and this one is the guarantee.
 */
const passwordWithConfirmation = {
  password: passwordSchema,
  passwordConfirmation: z.string(),
};

const matchesConfirmation = (value: { password: string; passwordConfirmation: string }) =>
  value.password === value.passwordConfirmation;

const CONFIRMATION_MISMATCH = {
  message: "The two passwords do not match.",
  // Fresh array per use: Zod's option type is mutable, so a shared frozen
  // literal would not satisfy it.
  get path() {
    return ["passwordConfirmation"];
  },
};

export const loginSchema = z.object({
  email: emailSchema,
  password: existingPasswordSchema,
  returnTo: returnToSchema,
  captchaToken: captchaTokenSchema,
});

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    email: emailSchema,
    // A checkbox submits a value only when ticked, so the literal is the check.
    acceptedTerms: z.literal("yes"),
    captchaToken: captchaTokenSchema,
    ...passwordWithConfirmation,
  })
  .refine(matchesConfirmation, CONFIRMATION_MISMATCH);

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  captchaToken: captchaTokenSchema,
});

export const resendConfirmationSchema = z.object({
  email: emailSchema,
  captchaToken: captchaTokenSchema,
});

export const magicLinkSchema = z.object({
  email: emailSchema,
  returnTo: returnToSchema,
  captchaToken: captchaTokenSchema,
});

export const resetPasswordSchema = z
  .object(passwordWithConfirmation)
  .refine(matchesConfirmation, CONFIRMATION_MISMATCH);

export const changePasswordSchema = z
  .object({ currentPassword: existingPasswordSchema, ...passwordWithConfirmation })
  .refine(matchesConfirmation, CONFIRMATION_MISMATCH);

/** Adding a first password to an OAuth-only account: there is no current one. */
export const addPasswordSchema = z
  .object(passwordWithConfirmation)
  .refine(matchesConfirmation, CONFIRMATION_MISMATCH);

export const emailChangeSchema = z.object({ newEmail: emailSchema });

export const oauthStartSchema = z.object({
  returnTo: returnToSchema,
  intent: z.enum(["signin", "link", "reauthenticate"]).default("signin"),
});

export const logoutSchema = z.object({
  scope: z.enum(["local", "others", "global"]).default("local"),
});

export const mfaEnrollVerifySchema = z.object({ factorId: z.uuid(), code: totpCodeSchema });

export const mfaChallengeSchema = z.object({
  factorId: z.uuid(),
  code: totpCodeSchema,
  returnTo: returnToSchema,
});

export const mfaUnenrollSchema = z.object({ factorId: z.uuid() });

export const legalAcceptanceSchema = z.object({
  acceptedTerms: z.literal("yes"),
  returnTo: returnToSchema,
});

export function formDataObject(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
