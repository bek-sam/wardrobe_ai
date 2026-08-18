import { describe, expect, it } from "vitest";

import type { User, UserIdentity } from "@supabase/supabase-js";

import { deletionReauthMethod } from "@/app/api/account/handler";
import { mapAuthError } from "@/lib/auth/auth-error";
import { hasPasswordIdentity, normalizeIdentities } from "@/lib/auth/server";
import { isSupportedProvider } from "@/lib/auth/server";
import { isRecentAuthentication, latestAuthenticationAt } from "@/lib/auth/server";
import { canUnlinkIdentity } from "@/lib/auth/server";

function identity(provider: string, id = provider): UserIdentity {
  return {
    identity_id: id,
    id: `${id}-sub`,
    user_id: "u1",
    provider,
    created_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-07-01T00:00:00Z",
    identity_data: { email: "sam@example.test", hosted_domain: "corp.example" },
  };
}

const asUser = (identities: UserIdentity[]) => ({ id: "u1", identities }) as unknown as User;

describe("identity normalization", () => {
  it("drops raw provider payloads", () => {
    const [normalized] = normalizeIdentities([identity("google")]);
    expect(normalized).toEqual({
      identityId: "google",
      provider: "google",
      label: "Google",
      recoveryCapable: true,
      createdAt: "2026-01-01T00:00:00Z",
      lastSignInAt: "2026-07-01T00:00:00Z",
    });
    expect(JSON.stringify(normalized)).not.toContain("hosted_domain");
    expect(JSON.stringify(normalized)).not.toContain("sam@example.test");
  });

  it("drops providers the application cannot manage", () => {
    expect(normalizeIdentities([identity("saml"), identity("email")])).toHaveLength(1);
  });

  it("rejects arbitrary provider names from a client", () => {
    expect(isSupportedProvider("google")).toBe(true);
    expect(isSupportedProvider("email")).toBe(true);
    expect(isSupportedProvider("saml")).toBe(false);
    expect(isSupportedProvider("__proto__")).toBe(false);
    expect(isSupportedProvider(42)).toBe(false);
  });

  it("treats only an email identity as proof of a password", () => {
    expect(hasPasswordIdentity(normalizeIdentities([identity("email")]))).toBe(true);
    expect(hasPasswordIdentity(normalizeIdentities([identity("google")]))).toBe(false);
  });
});

describe("last-identity protection", () => {
  const both = normalizeIdentities([identity("email"), identity("google")]);

  it("refuses to remove the only sign-in method", () => {
    const only = normalizeIdentities([identity("email")]);
    expect(canUnlinkIdentity(only, "email")).toEqual({ allowed: false, reason: "last_identity" });
  });

  it("refuses an identity that is not linked", () => {
    expect(canUnlinkIdentity(both, "apple")).toEqual({ allowed: false, reason: "not_linked" });
  });

  it("allows removal while another recoverable method remains", () => {
    expect(canUnlinkIdentity(both, "google")).toEqual({ allowed: true });
    expect(canUnlinkIdentity(both, "email")).toEqual({ allowed: true });
  });
});

describe("deletion reauthentication method", () => {
  it("asks for a password only when one actually exists", () => {
    expect(deletionReauthMethod(asUser([identity("email")]))).toBe("password");
  });

  it("uses the provider for a Google-only account, which has an email but no password", () => {
    expect(deletionReauthMethod(asUser([identity("google")]))).toBe("oauth");
  });

  it("falls back to a one-time email link when there is no usable provider", () => {
    expect(deletionReauthMethod(asUser([]))).toBe("email_link");
  });
});

describe("recent authentication", () => {
  const now = 1_800_000_000_000;

  it("accepts an authentication inside the window", () => {
    expect(isRecentAuthentication(now / 1000 - 60, now)).toBe(true);
  });

  it("rejects one that is too old", () => {
    expect(isRecentAuthentication(now / 1000 - 5_000, now)).toBe(false);
  });

  it("rejects a future timestamp rather than treating skew as freshness", () => {
    expect(isRecentAuthentication(now / 1000 + 600, now)).toBe(false);
  });

  it("cannot establish recency from timestamp-free RFC-8176 strings", () => {
    expect(latestAuthenticationAt(["password", "otp"])).toBeNull();
    expect(isRecentAuthentication(null, now)).toBe(false);
  });

  it("takes the newest timestamp when several methods are present", () => {
    expect(
      latestAuthenticationAt([
        { method: "password", timestamp: 100 },
        { method: "totp", timestamp: 900 },
      ]),
    ).toBe(900);
  });
});

describe("provider error mapping", () => {
  it("never surfaces the provider's own message", () => {
    const failure = mapAuthError({ code: "unexpected_failure", message: "internal db error" });
    expect(failure.message).not.toContain("db");
    expect(failure.code).toBe("unavailable");
  });

  it("collapses credential and confirmation failures onto one message", () => {
    expect(mapAuthError({ code: "invalid_credentials" }).message).toBe(
      mapAuthError({ code: "email_not_confirmed" }).message,
    );
  });

  it("uses the caller's enumeration-safe fallback for unmapped codes", () => {
    expect(mapAuthError({ code: "brand_new_code" }, "invalid_credentials").code).toBe(
      "invalid_credentials",
    );
  });

  it("recognizes a bare 429 with no code as throttling", () => {
    expect(mapAuthError({ status: 429 }).code).toBe("rate_limited");
  });
});
