import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

applyAuthTestEnvironment();

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SECRET = "a".repeat(64);

const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, updateUser, signOut } }),
}));

const insert = vi.fn().mockResolvedValue({ error: null });
const adminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }), rpc: adminRpc }),
}));

let cookieValue: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieValue ? { name, value: cookieValue } : undefined),
  }),
}));

const { signAuthAction } = await import("@/lib/auth/server");
const { POST } = await import("@/app/api/auth/reset-password/route");

function challenge(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return signAuthAction(
    {
      v: 1,
      purpose: "password_reset",
      userId: USER_ID,
      sessionId: null,
      nonce: "44444444-4444-4444-8444-444444444444",
      issuedAt: now,
      expiresAt: now + 600,
      ...overrides,
    } as never,
    SECRET,
  );
}

function resetRequest(password = "correct horse battery", origin = TEST_APP_URL) {
  const body = new FormData();
  body.append("password", password);
  body.append("passwordConfirmation", password);
  return new Request(new URL("/api/auth/reset-password", TEST_APP_URL), {
    method: "POST",
    headers: { origin },
    body,
  });
}

const location = (response: Response) => response.headers.get("location") ?? "";

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieValue = challenge();
    getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    adminRpc.mockResolvedValue({ data: true, error: null });
  });

  it("changes the password and revokes every other session", async () => {
    const response = await POST(resetRequest());
    expect(updateUser).toHaveBeenCalledWith({ password: "correct horse battery" });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(location(response)).toContain("/login");
    expect(location(response)).toContain("other+sessions+were+signed+out");
  });

  it("consumes the challenge before writing the new password", async () => {
    await POST(resetRequest());
    const consumeIndex = adminRpc.mock.calls.findIndex(
      (call) => call[0] === "consume_auth_action_challenge",
    );
    expect(consumeIndex).toBeGreaterThanOrEqual(0);
    expect(adminRpc.mock.invocationCallOrder[consumeIndex]!).toBeLessThan(
      updateUser.mock.invocationCallOrder[0]!,
    );
  });

  it("rejects a replay once the nonce has been spent", async () => {
    adminRpc.mockResolvedValue({ data: false, error: null });
    const response = await POST(resetRequest());
    expect(updateUser).not.toHaveBeenCalled();
    expect(location(response)).toContain("/forgot-password");
  });

  it("rejects an expired challenge", async () => {
    cookieValue = challenge({ expiresAt: Math.floor(Date.now() / 1000) - 1 });
    const response = await POST(resetRequest());
    expect(updateUser).not.toHaveBeenCalled();
    expect(location(response)).toContain("/forgot-password");
  });

  it("rejects a challenge minted for a different user", async () => {
    cookieValue = challenge({ userId: "22222222-2222-4222-8222-222222222222" });
    await POST(resetRequest());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a challenge minted for a different purpose", async () => {
    cookieValue = challenge({ purpose: "account_deletion" });
    await POST(resetRequest());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a forged signature", async () => {
    cookieValue = `${challenge().split(".")[0]}.forged`;
    await POST(resetRequest());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a session that is no longer valid", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    const response = await POST(resetRequest());
    expect(updateUser).not.toHaveBeenCalled();
    expect(location(response)).toContain("/forgot-password");
  });

  it("rejects a cross-origin submission", async () => {
    const response = await POST(resetRequest("correct horse battery", "https://evil.example"));
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("rejects a password below the policy minimum before touching the provider", async () => {
    const response = await POST(resetRequest("short"));
    expect(updateUser).not.toHaveBeenCalled();
    expect(location(response)).toContain("/reset-password");
  });

  it("clears the action cookie on every outcome", async () => {
    const success = await POST(resetRequest());
    expect(success.headers.get("set-cookie")).toContain("wardrobe-auth-action=");
    adminRpc.mockResolvedValue({ data: false, error: null });
    const rejected = await POST(resetRequest());
    expect(rejected.headers.get("set-cookie")).toContain("wardrobe-auth-action=");
  });
});
