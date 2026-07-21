import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(200),
  returnTo: z.string().max(500).optional(),
});

export const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  email: z.email().max(320),
  password: z.string().min(8).max(200),
  acceptedTerms: z.literal("yes"),
});

export const forgotPasswordSchema = z.object({ email: z.email().max(320) });

export function formDataObject(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function safeReturnTo(value: string | undefined | null, fallback = "/today") {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : fallback;
}
