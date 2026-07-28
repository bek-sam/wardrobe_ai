import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment } from "./auth-test-env";

applyAuthTestEnvironment();

const adminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: adminRpc }),
}));

const { normalizeRateLimitEmail, rateLimitIdentifier, UNKNOWN_IP_IDENTIFIER } =
  await import("@/lib/auth/rate-limit/identifiers");
const { consumeAuthRateLimit } = await import("@/lib/auth/rate-limit/consume");
const { AUTH_RATE_LIMITS } = await import("@/lib/auth/rate-limit/policies.data");
const { trustedClientIp } = await import("@/lib/api/client-ip");

describe("rate-limit identifiers", () => {
  it("is deterministic for the same scope and value", () => {
    expect(rateLimitIdentifier("email", "sam@example.test")).toBe(
      rateLimitIdentifier("email", "sam@example.test"),
    );
  });

  it("separates scopes, so one string cannot share a budget across axes", () => {
    const value = "sam@example.test";
    expect(rateLimitIdentifier("email", value)).not.toBe(rateLimitIdentifier("ip", value));
    expect(rateLimitIdentifier("email", value)).not.toBe(rateLimitIdentifier("user", value));
  });

  it("folds email case so variants cannot double an attacker's budget", () => {
    expect(rateLimitIdentifier("email", "SAM@Example.TEST")).toBe(
      rateLimitIdentifier("email", "sam@example.test"),
    );
    expect(normalizeRateLimitEmail("  SAM@Example.test ")).toBe("sam@example.test");
  });

  it("emits an opaque hash that contains no part of the raw identifier", () => {
    const hash = rateLimitIdentifier("email", "sam@example.test");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("sam");
    expect(hash).not.toContain("example");
  });
});

describe("trusted client IP", () => {
  const request = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/auth/login", { headers });

  it("returns null when no trusted header is configured, rather than trusting a forgeable one", () => {
    delete process.env.TRUSTED_CLIENT_IP_HEADER;
    vi.resetModules();
    expect(trustedClientIp(request({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
  });
});

describe("consumeAuthRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminRpc.mockResolvedValue({ data: { allowed: true }, error: null });
  });

  it("charges every bucket configured for the action", async () => {
    await consumeAuthRateLimit("login", { email: "sam@example.test", ip: "203.0.113.9" });
    expect(adminRpc).toHaveBeenCalledTimes(AUTH_RATE_LIMITS.login.length);
    expect(adminRpc.mock.calls[0]?.[1]).toMatchObject({
      p_action: "login",
      p_limit: AUTH_RATE_LIMITS.login[0].limit,
      p_window_seconds: AUTH_RATE_LIMITS.login[0].windowSeconds,
    });
  });

  it("stops at the first denial so a rejected request does not burn the rest", async () => {
    adminRpc.mockResolvedValueOnce({
      data: { allowed: false, retry_after_seconds: 300 },
      error: null,
    });
    const decision = await consumeAuthRateLimit("login", { email: "sam@example.test", ip: null });
    expect(decision).toEqual({ allowed: false, retryAfterSeconds: 300 });
    expect(adminRpc).toHaveBeenCalledTimes(1);
  });

  it("falls back to a shared bucket when no trustworthy IP is available", async () => {
    await consumeAuthRateLimit("signup", { email: "sam@example.test", ip: null });
    const ipCall = adminRpc.mock.calls[1]?.[1] as { p_identifier_hash: string };
    expect(ipCall.p_identifier_hash).toBe(rateLimitIdentifier("ip", UNKNOWN_IP_IDENTIFIER));
  });

  it("fails closed when the limiter itself is unreachable", async () => {
    adminRpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const decision = await consumeAuthRateLimit("login", { email: "sam@example.test", ip: null });
    expect(decision.allowed).toBe(false);
  });

  it("skips a bucket whose subject is absent instead of hashing an empty value", async () => {
    await consumeAuthRateLimit("reauthentication", { ip: null });
    expect(adminRpc).not.toHaveBeenCalled();
  });
});

describe("rate-limit policy shape", () => {
  it("limits every pre-auth action on both an email and an IP axis", () => {
    for (const action of [
      "signup",
      "login",
      "password_recovery",
      "confirmation_resend",
      "magic_link",
    ] as const) {
      const scopes = AUTH_RATE_LIMITS[action].map((rule) => rule.scope);
      expect(scopes).toContain("email");
      expect(scopes).toContain("ip");
    }
  });

  it("keys step-up attempts to the account, so nobody else can be locked out", () => {
    expect(AUTH_RATE_LIMITS.reauthentication.map((rule) => rule.scope)).toEqual(["user"]);
  });

  it("uses windows that expire, so no limit becomes a permanent lockout", () => {
    for (const rules of Object.values(AUTH_RATE_LIMITS)) {
      for (const rule of rules) {
        expect(rule.windowSeconds).toBeGreaterThan(0);
        expect(rule.windowSeconds).toBeLessThanOrEqual(3600);
      }
    }
  });
});
