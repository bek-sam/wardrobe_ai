import { describe, expect, it } from "vitest";

import type { User, UserIdentity } from "@supabase/supabase-js";

import { deletionReauthMethod } from "@/app/api/account/reauthentication-method";
import { mapAuthError } from "@/lib/auth/auth-error";
import { hasPasswordIdentity, normalizeIdentities } from "@/lib/auth/identities";
import { isSupportedProvider } from "@/lib/auth/providers.data";
import { isRecentAuthentication, latestAuthenticationAt } from "@/lib/auth/recent-auth";
import { carriedDestination } from "@/lib/proxy/carried-destination";
import { resolveRoute } from "@/lib/proxy/resolve-route";
import { canUnlinkIdentity } from "@/lib/auth/unlink-guard";

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

describe("proxy routing decisions", () => {
  it("sends an anonymous visitor to login with the destination attached", () => {
    expect(resolveRoute("/wardrobe", { signedIn: false, needsMfa: false })).toEqual({
      kind: "redirect",
      pathname: "/login",
      carryReturnTo: true,
    });
  });

  it("lets anonymous visitors reach the public auth pages", () => {
    for (const path of [
      "/",
      "/login",
      "/check-email",
      "/reset-password",
      "/auth/callback/recovery",
    ]) {
      expect(resolveRoute(path, { signedIn: false, needsMfa: false })).toEqual({
        kind: "continue",
      });
    }
  });

  it("holds an under-assured session at the challenge, whatever page it asked for", () => {
    for (const path of ["/wardrobe", "/settings", "/accept-terms", "/onboarding"]) {
      expect(resolveRoute(path, { signedIn: true, needsMfa: true })).toEqual({
        kind: "redirect",
        pathname: "/mfa/verify",
        carryReturnTo: true,
      });
    }
  });

  it("still allows the pages needed to finish or abandon the challenge", () => {
    for (const path of ["/mfa/verify", "/reset-password", "/privacy", "/terms"]) {
      expect(resolveRoute(path, { signedIn: true, needsMfa: true })).toEqual({ kind: "continue" });
    }
  });

  it("leaves API routes to enforce their own rules, so verifying stays possible at aal1", () => {
    expect(resolveRoute("/api/auth/mfa/verify", { signedIn: true, needsMfa: true })).toEqual({
      kind: "continue",
    });
    expect(resolveRoute("/api/auth/logout", { signedIn: true, needsMfa: true })).toEqual({
      kind: "continue",
    });
  });

  it("bounces a signed-in user off the signed-out-only pages", () => {
    expect(resolveRoute("/login", { signedIn: true, needsMfa: false })).toEqual({
      kind: "redirect",
      pathname: "/today",
      carryReturnTo: false,
    });
  });
});

describe("the destination carried onto a redirect", () => {
  const at = (path: string) => new URL(path, "https://wardrobe.test");

  it("carries the requested page, query and all", () => {
    expect(carriedDestination(at("/wardrobe?sort=recent"))).toBe("/wardrobe?sort=recent");
  });

  /**
   * An MFA-pending user loading `/login?returnTo=/wardrobe` must not be sent to
   * the challenge carrying `/login` as their destination: passing it would
   * return them to a signed-out-only page, which bounces to the default and
   * silently loses the `/wardrobe` they asked for.
   */
  it("unwraps the real destination from a signed-out-only route", () => {
    expect(carriedDestination(at("/login?returnTo=%2Fwardrobe"))).toBe("/wardrobe");
  });

  it("falls back to the default when such a route carries no destination", () => {
    expect(carriedDestination(at("/login"))).toBe("/today");
  });

  it("never carries an off-origin destination out of one", () => {
    expect(carriedDestination(at("/login?returnTo=https%3A%2F%2Fevil.example"))).toBe("/today");
    expect(carriedDestination(at("/login?returnTo=%2F%2Fevil.example"))).toBe("/today");
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
