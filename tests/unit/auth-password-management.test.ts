import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

applyAuthTestEnvironment();

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NEW_PASSWORD = "an entirely different passphrase";

const getUser = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser, signOut, mfa: { getAuthenticatorAssuranceLevel } },
  }),
}));

const adminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: adminRpc,
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
}));

const verifyPassword = vi.fn();
vi.mock("@/lib/supabase/verifier", () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { POST: changePassword } = await import("@/app/api/auth/change-password/route");
const { POST: addPassword } = await import("@/app/api/auth/add-password/route");

function identity(provider: string) {
  return { identity_id: provider, id: `${provider}-sub`, user_id: USER_ID, provider };
}

function user(providers: string[], overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: "sam@example.test",
    email_confirmed_at: "2026-02-02T00:00:00Z",
    identities: providers.map(identity),
    ...overrides,
  };
}

function jsonRequest(path: string, body: unknown, origin = TEST_APP_URL) {
  return new Request(new URL(path, TEST_APP_URL), {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const recent = [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }];

beforeEach(() => {
  vi.clearAllMocks();
  adminRpc.mockResolvedValue({ data: { allowed: true }, error: null });
  getUser.mockResolvedValue({ data: { user: user(["email"]) }, error: null });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: recent },
    error: null,
  });
  verifyPassword.mockResolvedValue(true);
  updateUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});

describe("POST /api/auth/change-password", () => {
  const body = {
    currentPassword: "the old passphrase",
    password: NEW_PASSWORD,
    passwordConfirmation: NEW_PASSWORD,
  };

  it("changes the password and revokes other sessions", async () => {
    const response = await changePassword(jsonRequest("/api/auth/change-password", body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { changed: true, other_sessions_signed_out: true },
    });
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes current_password through as well, for projects that require it", async () => {
    await changePassword(jsonRequest("/api/auth/change-password", body));
    expect(updateUser).toHaveBeenCalledWith({
      password: NEW_PASSWORD,
      current_password: "the old passphrase",
    });
  });

  it("verifies the current password before writing anything", async () => {
    verifyPassword.mockResolvedValue(false);
    const response = await changePassword(jsonRequest("/api/auth/change-password", body));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("reauthentication_failed");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses when the account has no password identity to change", async () => {
    getUser.mockResolvedValue({ data: { user: user(["google"]) }, error: null });
    const response = await changePassword(jsonRequest("/api/auth/change-password", body));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("password_unavailable");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("requires the second factor when one is enrolled", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await changePassword(jsonRequest("/api/auth/change-password", body));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("mfa_required");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("requires a live session rather than trusting local claims", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "revoked" } });
    const response = await changePassword(jsonRequest("/api/auth/change-password", body));
    expect(response.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a new password below the policy minimum", async () => {
    const response = await changePassword(
      jsonRequest("/api/auth/change-password", {
        ...body,
        password: "short",
        passwordConfirmation: "short",
      }),
    );
    expect(response.status).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a confirmation mismatch", async () => {
    const response = await changePassword(
      jsonRequest("/api/auth/change-password", {
        ...body,
        passwordConfirmation: "something else entirely",
      }),
    );
    expect(response.status).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request before touching auth", async () => {
    const response = await changePassword(
      jsonRequest("/api/auth/change-password", body, "https://evil.example"),
    );
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("throttles repeated attempts per user", async () => {
    adminRpc.mockResolvedValue({
      data: { allowed: false, retry_after_seconds: 300 },
      error: null,
    });
    const response = await changePassword(jsonRequest("/api/auth/change-password", body));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(verifyPassword).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/add-password", () => {
  const body = { password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD };

  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: user(["google"]) }, error: null });
  });

  it("adds a first password to a Google-only account", async () => {
    const response = await addPassword(jsonRequest("/api/auth/add-password", body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { added: true } });
  });

  it("updates the existing user and never creates a second account", async () => {
    await addPassword(jsonRequest("/api/auth/add-password", body));
    expect(updateUser).toHaveBeenCalledWith({ password: NEW_PASSWORD });
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  it("refuses when a password already exists", async () => {
    getUser.mockResolvedValue({ data: { user: user(["email", "google"]) }, error: null });
    const response = await addPassword(jsonRequest("/api/auth/add-password", body));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("password_exists");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses until the email address is confirmed", async () => {
    getUser.mockResolvedValue({
      data: { user: user(["google"], { email_confirmed_at: null }) },
      error: null,
    });
    const response = await addPassword(jsonRequest("/api/auth/add-password", body));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("email_unconfirmed");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses without a recent proof of identity", async () => {
    // Timestamp-free methods cannot establish recency, and no step-up
    // challenge cookie is present, so this must fail closed.
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: ["password"] },
      error: null,
    });
    const response = await addPassword(jsonRequest("/api/auth/add-password", body));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("reauthentication_required");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request", async () => {
    const response = await addPassword(
      jsonRequest("/api/auth/add-password", body, "https://evil.example"),
    );
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });
});
