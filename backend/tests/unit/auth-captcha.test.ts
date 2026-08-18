import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

const signInWithPassword = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword, mfa: { getAuthenticatorAssuranceLevel } },
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

function formRequest(fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return new Request(new URL("/api/auth/login", TEST_APP_URL), {
    method: "POST",
    headers: { origin: TEST_APP_URL },
    body,
  });
}

async function loginRoute() {
  vi.resetModules();
  return (await import("@/app/api/auth/login/route")).POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  adminRpc.mockResolvedValue({ data: { allowed: true }, error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
    error: null,
  });
  maybeSingle.mockResolvedValue({ data: { id: "legal-1" }, error: null });
});

afterEach(() => {
  applyAuthTestEnvironment();
  vi.resetModules();
});

describe("CAPTCHA enforcement", () => {
  it("does not require a token when the feature is off", async () => {
    applyAuthTestEnvironment({ NEXT_PUBLIC_CAPTCHA_ENABLED: "false" });
    const login = await loginRoute();
    const response = await login(formRequest({ email: "a@b.test", password: "x" }));
    expect(response.headers.get("location")).toBe("/today");
    expect(signInWithPassword).toHaveBeenCalledWith(
      expect.not.objectContaining({ options: expect.anything() }),
    );
  });

  it("fails closed when enabled and no token is submitted", async () => {
    applyAuthTestEnvironment({
      NEXT_PUBLIC_CAPTCHA_ENABLED: "true",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x0000000000000000000000",
    });
    const login = await loginRoute();
    const response = await login(formRequest({ email: "a@b.test", password: "x" }));
    expect(response.headers.get("location")).toContain("verification+challenge");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("fails closed on a token that is only whitespace", async () => {
    applyAuthTestEnvironment({
      NEXT_PUBLIC_CAPTCHA_ENABLED: "true",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x0000000000000000000000",
    });
    const login = await loginRoute();
    const response = await login(
      formRequest({ email: "a@b.test", password: "x", captchaToken: "   " }),
    );
    expect(response.headers.get("location")).toContain("verification+challenge");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("hands the token to Supabase, which holds the secret and verifies it", async () => {
    applyAuthTestEnvironment({
      NEXT_PUBLIC_CAPTCHA_ENABLED: "true",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x0000000000000000000000",
    });
    const login = await loginRoute();
    await login(formRequest({ email: "a@b.test", password: "x", captchaToken: "turnstile-token" }));
    expect(signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ options: { captchaToken: "turnstile-token" } }),
    );
  });

  it("treats an enabled flag with no site key as a configuration error, not a silent bypass", async () => {
    applyAuthTestEnvironment({
      NEXT_PUBLIC_CAPTCHA_ENABLED: "true",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    });
    vi.resetModules();
    const { getAuthFlags } = await import("@/lib/auth/server");
    expect(() => getAuthFlags()).toThrow(/TURNSTILE_SITE_KEY/);
  });
});
