import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

applyAuthTestEnvironment();

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resend = vi.fn();
const resetPasswordForEmail = vi.fn();
const signInWithOtp = vi.fn();
const signOut = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword,
      signUp,
      resend,
      resetPasswordForEmail,
      signInWithOtp,
      signOut,
      mfa: { getAuthenticatorAssuranceLevel },
    },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle }) }) }) }),
    }),
  }),
}));

const adminRpc = vi.fn();
const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: adminRpc, from: () => ({ insert }) }),
}));

const { POST: login } = await import("@/app/api/auth/login/route");
const { POST: signup } = await import("@/app/api/auth/signup/route");
const { POST: forgotPassword } = await import("@/app/api/auth/forgot-password/route");
const { POST: resendConfirmation } = await import("@/app/api/auth/resend-confirmation/route");
const { POST: magicLink } = await import("@/app/api/auth/magic-link/route");
const { POST: logout } = await import("@/app/api/auth/logout/route");

function formRequest(path: string, fields: Record<string, string>, origin = TEST_APP_URL) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return new Request(new URL(path, TEST_APP_URL), { method: "POST", headers: { origin }, body });
}

const location = (response: Response) => response.headers.get("location") ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  adminRpc.mockResolvedValue({ data: { allowed: true }, error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({
    data: { user: { id: "u1", identities: [{ identity_id: "e1" }] }, session: null },
    error: null,
  });
  resend.mockResolvedValue({ error: null });
  resetPasswordForEmail.mockResolvedValue({ error: null });
  signInWithOtp.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
    error: null,
  });
  maybeSingle.mockResolvedValue({ data: { id: "legal-1" }, error: null });
});

describe("POST /api/auth/login", () => {
  it("rejects a cross-origin submission before reading the body or calling the provider", async () => {
    const response = await login(
      formRequest("/api/auth/login", { email: "a@b.test", password: "x" }, "https://evil.example"),
    );
    expect(response.status).toBe(403);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("sends the user to the sanitized destination on success", async () => {
    const response = await login(
      formRequest("/api/auth/login", {
        email: "a@b.test",
        password: "x",
        returnTo: "/wardrobe?favorite=true",
      }),
    );
    expect(response.status).toBe(303);
    expect(location(response)).toBe("/wardrobe?favorite=true");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses an off-site returnTo even after a correct password", async () => {
    const response = await login(
      formRequest("/api/auth/login", {
        email: "a@b.test",
        password: "x",
        returnTo: "https://evil.example/steal",
      }),
    );
    expect(location(response)).toBe("/today");
  });

  it("gives the same generic error for a wrong password and an unconfirmed account", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const wrongPassword = location(
      await login(formRequest("/api/auth/login", { email: "a@b.test", password: "x" })),
    );
    signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed" } });
    const unconfirmed = location(
      await login(formRequest("/api/auth/login", { email: "a@b.test", password: "x" })),
    );
    expect(wrongPassword).toBe(unconfirmed);
    expect(wrongPassword).toContain("The+email+or+password+is+incorrect.");
  });

  it("routes to the MFA challenge instead of the requested page when a factor is pending", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await login(
      formRequest("/api/auth/login", { email: "a@b.test", password: "x", returnTo: "/wardrobe" }),
    );
    expect(location(response)).toBe("/mfa/verify?returnTo=%2Fwardrobe");
  });

  it("routes to the acceptance screen when consent is missing", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await login(
      formRequest("/api/auth/login", { email: "a@b.test", password: "x" }),
    );
    expect(location(response)).toBe("/accept-terms?returnTo=%2Ftoday");
  });

  it("returns 429 with a Retry-After when throttled", async () => {
    adminRpc.mockResolvedValue({
      data: { allowed: false, retry_after_seconds: 120 },
      error: null,
    });
    const response = await login(
      formRequest("/api/auth/login", { email: "a@b.test", password: "x" }),
    );
    expect(location(response)).toContain("Too+many+attempts");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/signup", () => {
  const fields = {
    firstName: "Sam",
    email: "sam@example.test",
    password: "correct horse battery",
    passwordConfirmation: "correct horse battery",
    acceptedTerms: "yes",
  };

  it("sends a new account to the confirmation page and records consent", async () => {
    const response = await signup(formRequest("/api/auth/signup", fields));
    expect(location(response)).toBe("/check-email");
    expect(adminRpc).toHaveBeenCalledWith(
      "record_legal_acceptance",
      expect.objectContaining({ p_user_id: "u1", p_source: "signup" }),
    );
  });

  it("does not record consent for the decoy user returned for an existing address", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [] }, session: null },
      error: null,
    });
    const response = await signup(formRequest("/api/auth/signup", fields));
    // Identical outcome, so the response cannot be used to test for an account.
    expect(location(response)).toBe("/check-email");
    expect(adminRpc).not.toHaveBeenCalledWith("record_legal_acceptance", expect.anything());
  });

  it("rejects a password confirmation mismatch before calling the provider", async () => {
    const response = await signup(
      formRequest("/api/auth/signup", { ...fields, passwordConfirmation: "different one here" }),
    );
    expect(location(response)).toContain("/signup");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("fails closed at the server when public signup is disabled", async () => {
    process.env.PUBLIC_SIGNUP_ENABLED = "false";
    vi.resetModules();
    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(formRequest("/api/auth/signup", fields));
    expect(location(response)).toContain("invite-only");
    process.env.PUBLIC_SIGNUP_ENABLED = "true";
    vi.resetModules();
  });
});

describe("enumeration-safe email flows", () => {
  it("answers password recovery identically whether or not the send succeeded", async () => {
    const ok = location(
      await forgotPassword(formRequest("/api/auth/forgot-password", { email: "a@b.test" })),
    );
    resetPasswordForEmail.mockRejectedValue(new Error("boom"));
    const failed = location(
      await forgotPassword(formRequest("/api/auth/forgot-password", { email: "a@b.test" })),
    );
    expect(ok).toBe(failed);
    expect(ok).toContain("If+an+account+exists");
  });

  it("sends recovery to the dedicated callback, never to Settings", async () => {
    await forgotPassword(formRequest("/api/auth/forgot-password", { email: "a@b.test" }));
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "a@b.test",
      expect.objectContaining({ redirectTo: `${TEST_APP_URL}/auth/callback/recovery` }),
    );
  });

  it("answers confirmation resend identically for unknown and already-confirmed addresses", async () => {
    const first = location(
      await resendConfirmation(formRequest("/api/auth/resend-confirmation", { email: "a@b.test" })),
    );
    resend.mockResolvedValue({ error: { code: "validation_failed" } });
    const second = location(
      await resendConfirmation(formRequest("/api/auth/resend-confirmation", { email: "a@b.test" })),
    );
    expect(first).toBe(second);
  });

  it("keeps magic link absent unless the flag is on", async () => {
    const response = await magicLink(formRequest("/api/auth/magic-link", { email: "a@b.test" }));
    expect(location(response)).toContain("/login");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("never creates a user from a magic-link request when enabled", async () => {
    process.env.NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED = "true";
    vi.resetModules();
    const { POST } = await import("@/app/api/auth/magic-link/route");
    await POST(formRequest("/api/auth/magic-link", { email: "a@b.test" }));
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    );
    process.env.NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED = "false";
    vi.resetModules();
  });
});

describe("POST /api/auth/logout", () => {
  it("defaults to this device only", async () => {
    const response = await logout(formRequest("/api/auth/logout", {}));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(location(response)).toContain("/login");
  });

  it("keeps the current session when signing out other devices", async () => {
    const response = await logout(formRequest("/api/auth/logout", { scope: "others" }));
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(location(response)).toContain("/settings");
    expect(location(response)).toContain("this+one+stays+signed+in");
  });

  it("includes this device when signing out everywhere", async () => {
    const response = await logout(formRequest("/api/auth/logout", { scope: "global" }));
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(location(response)).toContain("including+this+device");
  });

  it("rejects an unknown scope rather than guessing", async () => {
    const response = await logout(formRequest("/api/auth/logout", { scope: "everything" }));
    expect(signOut).not.toHaveBeenCalled();
    expect(location(response)).toContain("/settings");
  });

  it("does not report a failed remote revocation as a clean sign-out", async () => {
    signOut.mockResolvedValueOnce({ error: { message: "boom" } });
    const response = await logout(formRequest("/api/auth/logout", { scope: "global" }));
    expect(location(response)).toContain("other+sessions+may+still+be+active");
    // The local session is still dropped, so this device is secured either way.
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("rejects a cross-origin sign-out", async () => {
    const response = await logout(formRequest("/api/auth/logout", {}, "https://evil.example"));
    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });
});
