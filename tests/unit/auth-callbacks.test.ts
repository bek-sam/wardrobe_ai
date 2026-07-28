import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

applyAuthTestEnvironment();

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "a".repeat(64);

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const getClaims = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession,
      getUser,
      getClaims,
      mfa: { getAuthenticatorAssuranceLevel },
    },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle }) }) }) }),
    }),
  }),
}));

const adminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: adminRpc,
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
}));

let cookieValue: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieValue ? { name, value: cookieValue } : undefined),
  }),
}));

const { signAuthAction } = await import("@/lib/auth/action-challenges/token");
const { GET: defaultCallback } = await import("@/app/auth/callback/route");
const { GET: recoveryCallback } = await import("@/app/auth/callback/recovery/route");
const { GET: magicLinkCallback } = await import("@/app/auth/callback/magic-link/route");
const { GET: reauthCallback } = await import("@/app/auth/callback/reauthenticate/route");

function pendingChallenge(userId = USER_ID) {
  const now = Math.floor(Date.now() / 1000);
  return signAuthAction(
    {
      v: 1,
      purpose: "sensitive_change",
      userId,
      sessionId: null,
      nonce: "44444444-4444-4444-8444-444444444444",
      issuedAt: now,
      expiresAt: now + 600,
    } as never,
    SECRET,
  );
}

const callbackRequest = (path: string, query = "?code=one-time-code") =>
  new Request(new URL(`${path}${query}`, TEST_APP_URL));

const location = (response: Response) => response.headers.get("location") ?? "";
const setCookie = (response: Response) => response.headers.get("set-cookie") ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  cookieValue = null;
  exchangeCodeForSession.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  getClaims.mockResolvedValue({ data: { claims: { sub: USER_ID, session_id: "sess-1" } } });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
    error: null,
  });
  maybeSingle.mockResolvedValue({ data: { id: "legal-1" }, error: null });
  adminRpc.mockResolvedValue({ data: true, error: null });
});

describe("the default callback", () => {
  it("sends a confirmed user to the sanitized destination", async () => {
    const response = await defaultCallback(
      callbackRequest("/auth/callback", "?code=abc&returnTo=%2Fonboarding"),
    );
    expect(location(response)).toBe("/onboarding");
  });

  it("refuses an off-site returnTo even on a valid confirmation", async () => {
    const response = await defaultCallback(
      callbackRequest("/auth/callback", "?code=abc&returnTo=https%3A%2F%2Fevil.example"),
    );
    expect(location(response)).toBe("/today");
  });

  it("cannot mint a password-reset challenge", async () => {
    const response = await defaultCallback(callbackRequest("/auth/callback"));
    expect(setCookie(response)).not.toContain("wardrobe-auth-action");
    expect(adminRpc).not.toHaveBeenCalledWith("issue_auth_action_challenge", expect.anything());
  });

  it("reports a cancelled or errored provider return generically", async () => {
    const response = await defaultCallback(
      callbackRequest("/auth/callback", "?error=access_denied&error_description=User+denied"),
    );
    expect(location(response)).toContain("/login");
    expect(location(response)).toContain("invalid%2C+already+used%2C+or+expired");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("rejects a callback with no code at all", async () => {
    const response = await defaultCallback(callbackRequest("/auth/callback", ""));
    expect(location(response)).toContain("/login");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("rejects a replayed code, whose exchange has already been spent", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "flow_state_not_found" } });
    const response = await defaultCallback(callbackRequest("/auth/callback"));
    expect(location(response)).toContain("/login");
  });

  it("rejects an exchange that succeeds but yields no live user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "gone" } });
    const response = await defaultCallback(callbackRequest("/auth/callback"));
    expect(location(response)).toContain("/login");
  });

  it("still routes an enrolled account to the MFA challenge", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await defaultCallback(
      callbackRequest("/auth/callback", "?code=abc&returnTo=%2Fwardrobe"),
    );
    expect(location(response)).toBe("/mfa/verify?returnTo=%2Fwardrobe");
  });
});

describe("the recovery callback", () => {
  it("mints a single-use password-reset challenge and sends the user to reset", async () => {
    const response = await recoveryCallback(callbackRequest("/auth/callback/recovery"));
    expect(location(response)).toBe("/reset-password");
    expect(setCookie(response)).toContain("wardrobe-auth-action=");
    expect(setCookie(response)).toContain("HttpOnly");
    expect(adminRpc).toHaveBeenCalledWith(
      "issue_auth_action_challenge",
      expect.objectContaining({ p_user_id: USER_ID, p_purpose: "password_reset" }),
    );
  });

  it("mints nothing when the link is expired or already used", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "otp_expired" } });
    const response = await recoveryCallback(callbackRequest("/auth/callback/recovery"));
    expect(location(response)).toContain("/forgot-password");
    expect(setCookie(response)).not.toContain("wardrobe-auth-action=ey");
    expect(adminRpc).not.toHaveBeenCalled();
  });
});

describe("the magic-link callback", () => {
  it("signs the user in and honours a sanitized destination", async () => {
    const response = await magicLinkCallback(
      callbackRequest("/auth/callback/magic-link", "?code=abc&returnTo=%2Foutfits"),
    );
    expect(location(response)).toBe("/outfits");
  });

  it("does not let a link bypass an enrolled second factor", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await magicLinkCallback(callbackRequest("/auth/callback/magic-link"));
    expect(location(response)).toContain("/mfa/verify");
  });
});

describe("the reauthentication callback", () => {
  it("trades a matching pending challenge for a deletion authorization", async () => {
    cookieValue = pendingChallenge();
    const response = await reauthCallback(callbackRequest("/auth/callback/reauthenticate"));
    expect(location(response)).toContain("/settings");
    expect(location(response)).toContain("Identity+confirmed");
    expect(adminRpc).toHaveBeenCalledWith(
      "issue_auth_action_challenge",
      expect.objectContaining({ p_purpose: "account_deletion", p_user_id: USER_ID }),
    );
  });

  it("refuses when a different account comes back from the provider", async () => {
    // The deletion was started by USER_ID; the provider returned OTHER_USER_ID.
    cookieValue = pendingChallenge(USER_ID);
    getUser.mockResolvedValue({ data: { user: { id: OTHER_USER_ID } }, error: null });

    const response = await reauthCallback(callbackRequest("/auth/callback/reauthenticate"));
    expect(location(response)).toContain("did+not+match+our+records");
    expect(adminRpc).not.toHaveBeenCalledWith(
      "issue_auth_action_challenge",
      expect.objectContaining({ p_purpose: "account_deletion" }),
    );
  });

  it("refuses a replayed pending challenge", async () => {
    cookieValue = pendingChallenge();
    adminRpc.mockImplementation((name: string) =>
      name === "consume_auth_action_challenge"
        ? Promise.resolve({ data: false, error: null })
        : Promise.resolve({ data: null, error: null }),
    );
    const response = await reauthCallback(callbackRequest("/auth/callback/reauthenticate"));
    expect(location(response)).toContain("did+not+match+our+records");
    expect(adminRpc).not.toHaveBeenCalledWith(
      "issue_auth_action_challenge",
      expect.objectContaining({ p_purpose: "account_deletion" }),
    );
  });

  it("refuses when no challenge was ever issued", async () => {
    cookieValue = null;
    const response = await reauthCallback(callbackRequest("/auth/callback/reauthenticate"));
    expect(location(response)).toContain("did+not+match+our+records");
  });

  it("clears the cookie on a rejected return", async () => {
    cookieValue = null;
    const response = await reauthCallback(callbackRequest("/auth/callback/reauthenticate"));
    expect(setCookie(response)).toContain("wardrobe-auth-action=;");
  });
});
