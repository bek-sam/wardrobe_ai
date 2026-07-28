import { describe, expect, it } from "vitest";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import {
  changePasswordSchema,
  emailSchema,
  existingPasswordSchema,
  loginSchema,
  passwordSchema,
  resetPasswordSchema,
  signupSchema,
  totpCodeSchema,
} from "@/features/auth/schemas";

const valid = "correct horse battery";

describe("password policy", () => {
  it("enforces the minimum at the boundary", () => {
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
  });

  it("enforces the maximum at the boundary", () => {
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });

  it("accepts at least 128 characters, as password managers generate", () => {
    expect(PASSWORD_MAX_LENGTH).toBeGreaterThanOrEqual(128);
    expect(passwordSchema.safeParse("x".repeat(128)).success).toBe(true);
  });

  it("never trims, lowercases, or normalizes the value", () => {
    const padded = `  ${valid}  `;
    expect(passwordSchema.parse(padded)).toBe(padded);
    const mixedCase = "MiXeD Case Passphrase";
    expect(passwordSchema.parse(mixedCase)).toBe(mixedCase);
    // Composed vs decomposed forms are different secrets and must stay so.
    const decomposed = "café passphrase long";
    expect(passwordSchema.parse(decomposed)).toBe(decomposed);
  });

  it("counts Unicode code points, not UTF-16 units", () => {
    // 14 astral code points are 28 UTF-16 units: below the minimum either way
    // when counted correctly, and wrongly accepted if counted as `.length`.
    expect(passwordSchema.safeParse("😀".repeat(14)).success).toBe(false);
    expect(passwordSchema.safeParse("😀".repeat(15)).success).toBe(true);
  });

  it("requires no composition rules and allows spaces", () => {
    expect(passwordSchema.safeParse("all lowercase words here").success).toBe(true);
  });

  it("does not apply the new minimum to sign-in, so older accounts can still get in", () => {
    expect(existingPasswordSchema.safeParse("short").success).toBe(true);
    expect(existingPasswordSchema.safeParse("").success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.test", password: "old" }).success).toBe(true);
  });
});

describe("password confirmation", () => {
  it("rejects a mismatch and points at the confirmation field", () => {
    const result = resetPasswordSchema.safeParse({
      password: valid,
      passwordConfirmation: `${valid}!`,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["passwordConfirmation"]);
  });

  it("accepts a match on every flow that changes a password", () => {
    const pair = { password: valid, passwordConfirmation: valid };
    expect(resetPasswordSchema.safeParse(pair).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...pair, currentPassword: "old" }).success).toBe(true);
    expect(
      signupSchema.safeParse({
        ...pair,
        firstName: "Sam",
        email: "sam@example.test",
        acceptedTerms: "yes",
      }).success,
    ).toBe(true);
  });

  it("requires the Terms checkbox to have been ticked", () => {
    const result = signupSchema.safeParse({
      password: valid,
      passwordConfirmation: valid,
      firstName: "Sam",
      email: "sam@example.test",
    });
    expect(result.success).toBe(false);
  });
});

describe("email and code parsing", () => {
  it("trims surrounding whitespace but leaves the address itself alone", () => {
    expect(emailSchema.parse("  Sam@Example.test  ")).toBe("Sam@Example.test");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("accepts only a six-digit TOTP code", () => {
    expect(totpCodeSchema.parse(" 123456 ")).toBe("123456");
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
    expect(totpCodeSchema.safeParse("1234567").success).toBe(false);
    expect(totpCodeSchema.safeParse("12345a").success).toBe(false);
  });
});
