import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

applyAuthTestEnvironment({ NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true" });

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FACTOR_ID = "55555555-5555-4555-8555-555555555555";

const signInWithOAuth = vi.fn();
const getUser = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const enroll = vi.fn();
const challengeAndVerify = vi.fn();
const unenroll = vi.fn();
const updateUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOAuth,
      getUser,
      updateUser,
      mfa: { getAuthenticatorAssuranceLevel, enroll, challengeAndVerify, unenroll },
    },
  }),
}));

const adminRpc = vi.fn();
const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: adminRpc, from: () => ({ insert }) }),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { POST: startOAuth } = await import("@/app/api/auth/oauth/google/route");
const { POST: enrollMfa } = await import("@/app/api/auth/mfa/enroll/route");
const { POST: verifyMfa } = await import("@/app/api/auth/mfa/verify/route");
const { POST: unenrollMfa } = await import("@/app/api/auth/mfa/unenroll/route");
const { POST: changeEmail } = await import("@/app/api/auth/email-change/route");

function formRequest(path: string, fields: Record<string, string>, origin = TEST_APP_URL) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return new Request(new URL(path, TEST_APP_URL), { method: "POST", headers: { origin }, body });
}

function jsonRequest(path: string, body: unknown, origin = TEST_APP_URL) {
  return new Request(new URL(path, TEST_APP_URL), {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const recentMethods = [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }];

beforeEach(() => {
  vi.clearAllMocks();
  adminRpc.mockResolvedValue({ data: { allowed: true }, error: null });
  signInWithOAuth.mockResolvedValue({
    data: { url: "https://project.supabase.co/auth/v1/authorize?provider=google" },
    error: null,
  });
  getUser.mockResolvedValue({
    data: { user: { id: USER_ID, email: "sam@example.test", identities: [] } },
    error: null,
  });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: recentMethods },
    error: null,
  });
  enroll.mockResolvedValue({
    data: {
      id: FACTOR_ID,
      type: "totp",
      totp: { qr_code: "<svg/>", secret: "S", uri: "otpauth://" },
    },
    error: null,
  });
  challengeAndVerify.mockResolvedValue({ error: null });
  unenroll.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
});

describe("POST /api/auth/oauth/google", () => {
  it("redirects only to the URL Supabase returned", async () => {
    const response = await startOAuth(formRequest("/api/auth/oauth/google", { intent: "signin" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://project.supabase.co/auth/v1/authorize?provider=google",
    );
  });

  it("requests only OpenID, email, and profile, and no offline access", async () => {
    await startOAuth(formRequest("/api/auth/oauth/google", { intent: "signin" }));
    const options = signInWithOAuth.mock.calls[0]?.[0].options;
    expect(options.scopes).toBe("openid email profile");
    expect(options.skipBrowserRedirect).toBe(true);
    expect(JSON.stringify(options)).not.toContain("offline");
  });

  it("carries a sanitized destination through the callback URL", async () => {
    await startOAuth(
      formRequest("/api/auth/oauth/google", { intent: "signin", returnTo: "https://evil.example" }),
    );
    expect(signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
      `${TEST_APP_URL}/auth/callback?returnTo=%2Ftoday`,
    );
  });

  it("rejects a cross-origin start before contacting the provider", async () => {
    const response = await startOAuth(
      formRequest("/api/auth/oauth/google", { intent: "signin" }, "https://evil.example"),
    );
    expect(response.status).toBe(403);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("is absent, not merely disabled, when the provider flag is off", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED = "false";
    vi.resetModules();
    const { POST } = await import("@/app/api/auth/oauth/google/route");
    const response = await POST(formRequest("/api/auth/oauth/google", { intent: "signin" }));
    expect(response.headers.get("location")).toContain("not+available");
    expect(signInWithOAuth).not.toHaveBeenCalled();
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED = "true";
    vi.resetModules();
  });

  it("reports a provider failure without leaking its message", async () => {
    signInWithOAuth.mockResolvedValue({ data: null, error: { code: "provider_disabled" } });
    const response = await startOAuth(formRequest("/api/auth/oauth/google", { intent: "signin" }));
    expect(response.headers.get("location")).toContain("/login");
  });
});

describe("MFA routes", () => {
  it("returns provisioning material for a new factor", async () => {
    const response = await enrollMfa(jsonRequest("/api/auth/mfa/enroll", {}));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ factor_id: FACTOR_ID, secret: "S" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("verifies a challenge while still at aal1, which is where the user is", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await verifyMfa(
      jsonRequest("/api/auth/mfa/verify", { factorId: FACTOR_ID, code: "123456" }),
    );
    expect(response.status).toBe(200);
    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: FACTOR_ID, code: "123456" });
  });

  it("rejects a malformed code before it reaches the provider", async () => {
    const response = await verifyMfa(
      jsonRequest("/api/auth/mfa/verify", { factorId: FACTOR_ID, code: "12345" }),
    );
    expect(response.status).toBe(422);
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });

  it("returns a generic failure for a wrong code", async () => {
    challengeAndVerify.mockResolvedValue({ error: { code: "mfa_verification_failed" } });
    const response = await verifyMfa(
      jsonRequest("/api/auth/mfa/verify", { factorId: FACTOR_ID, code: "123456" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("mfa_invalid_code");
  });

  it("refuses to remove a factor from a session that has not satisfied it", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await unenrollMfa(
      jsonRequest("/api/auth/mfa/unenroll", { factorId: FACTOR_ID }),
    );
    expect(response.status).toBe(403);
    expect(unenroll).not.toHaveBeenCalled();
  });

  it("removes a factor once the session is at aal2", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: {
        currentLevel: "aal2",
        nextLevel: "aal2",
        currentAuthenticationMethods: recentMethods,
      },
      error: null,
    });
    const response = await unenrollMfa(
      jsonRequest("/api/auth/mfa/unenroll", { factorId: FACTOR_ID }),
    );
    expect(response.status).toBe(200);
    expect(unenroll).toHaveBeenCalledWith({ factorId: FACTOR_ID });
  });

  it("rejects a non-uuid factor id rather than forwarding it", async () => {
    const response = await unenrollMfa(
      jsonRequest("/api/auth/mfa/unenroll", { factorId: "../../other-user" }),
    );
    expect(response.status).toBe(422);
    expect(unenroll).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin MFA mutation", async () => {
    const response = await unenrollMfa(
      jsonRequest("/api/auth/mfa/unenroll", { factorId: FACTOR_ID }, "https://evil.example"),
    );
    expect(response.status).toBe(403);
    expect(unenroll).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/email-change", () => {
  it("starts the double confirmation and does not replace the address yet", async () => {
    const response = await changeEmail(
      jsonRequest("/api/auth/email-change", { newEmail: "new@example.test" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ pending: true });
    expect(updateUser).toHaveBeenCalledWith(
      { email: "new@example.test" },
      { emailRedirectTo: `${TEST_APP_URL}/auth/callback?returnTo=%2Fsettings` },
    );
  });

  it("refuses a change to the address already in use on this account", async () => {
    const response = await changeEmail(
      jsonRequest("/api/auth/email-change", { newEmail: "SAM@example.test" }),
    );
    expect(response.status).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses a malformed address before contacting the provider", async () => {
    const response = await changeEmail(
      jsonRequest("/api/auth/email-change", { newEmail: "not-an-email" }),
    );
    expect(response.status).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("keeps a duplicate-address failure indistinguishable from any other", async () => {
    updateUser.mockResolvedValue({ error: { code: "email_exists" } });
    const response = await changeEmail(
      jsonRequest("/api/auth/email-change", { newEmail: "taken@example.test" }),
    );
    const body = await response.json();
    expect(body.error.message).toBe("That email address could not be used. Try a different one.");
  });
});
