import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

applyAuthTestEnvironment();

const USER_ID = "11111111-1111-4111-8111-111111111111";

const getUser = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const rpc = vi.fn();
const order = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, mfa: { getAuthenticatorAssuranceLevel } },
    rpc,
    from: () => ({ select: () => ({ order }) }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: { allowed: true }, error: null }),
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
}));

const { POST } = await import("@/app/api/account/export/route");

const exportRequest = (origin = TEST_APP_URL) =>
  new Request(new URL("/api/account/export", TEST_APP_URL), {
    method: "POST",
    headers: { origin },
  });

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({
    data: {
      user: {
        id: USER_ID,
        email: "sam@example.test",
        identities: [{ identity_id: "e1", id: "s", user_id: USER_ID, provider: "email" }],
      },
    },
    error: null,
  });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
    error: null,
  });
  rpc.mockResolvedValue({ data: { schema_version: 1, wardrobe_items: [] }, error: null });
  order.mockResolvedValue({ data: [], error: null });
});

describe("POST /api/account/export", () => {
  it("returns the export as an uncacheable attachment", async () => {
    const response = await POST(exportRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toMatch(
      /attachment; filename="wardrobe-ai-export-\d{4}-\d{2}-\d{2}\.json"/,
    );
  });

  it("requires a live session, not merely locally verified claims", async () => {
    // A revoked-but-unexpired token still verifies locally; getUser() is what
    // catches it, and an export is the whole account in one file.
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "revoked" } });
    const response = await POST(exportRequest());
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires the second factor when one is enrolled", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await POST(exportRequest());
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("mfa_required");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request before resolving the user", async () => {
    const response = await POST(exportRequest("https://evil.example"));
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("reads relational data through the caller's own RLS-bound RPC", async () => {
    await POST(exportRequest());
    expect(rpc).toHaveBeenCalledWith("export_my_account_data");
  });
});
