import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment, TEST_APP_URL } from "./auth-test-env";

applyAuthTestEnvironment();

const USER_ID = "11111111-1111-4111-8111-111111111111";

const getUser = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const rpc = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, signOut, mfa: { getAuthenticatorAssuranceLevel } },
    rpc,
  }),
}));

const deleteUser = vi.fn();
const adminRpc = vi.fn();
const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser } },
    from: () => ({ insert }),
    rpc: adminRpc,
  }),
}));

const verifyPassword = vi.fn();
vi.mock("@/lib/supabase/verifier", () => ({
  verifyPassword: (...a: unknown[]) => verifyPassword(...a),
}));

const consumeDeletionAuthorization = vi.fn();
vi.mock("@/app/api/account/deletion-challenge", () => ({
  consumeDeletionAuthorization: () => consumeDeletionAuthorization(),
}));

const { DELETE } = await import("@/app/api/account/route");

function passwordUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: "user@example.com",
    identities: [{ identity_id: "e1", provider: "email", user_id: USER_ID, id: "x" }],
    ...overrides,
  };
}

function googleUser() {
  return {
    id: USER_ID,
    email: "user@example.com",
    identities: [{ identity_id: "g1", provider: "google", user_id: USER_ID, id: "y" }],
  };
}

function deleteRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(new URL("/api/account", TEST_APP_URL), {
    method: "DELETE",
    headers: { origin: TEST_APP_URL, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: passwordUser() }, error: null });
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
      error: null,
    });
    verifyPassword.mockResolvedValue(true);
    consumeDeletionAuthorization.mockResolvedValue(true);
    rpc.mockImplementation((name: string) =>
      Promise.resolve({
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          user_id: USER_ID,
          status:
            name === "start_account_deletion" ? "storage_deletion_queued" : "deleting_auth_user",
          storage_objects_total: 3,
        },
        error: null,
      }),
    );
    adminRpc.mockImplementation((name: string) => {
      if (name === "consume_auth_rate_limit") {
        return Promise.resolve({ data: { allowed: true }, error: null });
      }
      return Promise.resolve({
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          user_id: USER_ID,
          status: "auth_deleted_storage_pending",
          storage_objects_total: 3,
        },
        error: null,
      });
    });
    deleteUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("rejects a forged cross-origin request before touching auth", async () => {
    const response = await DELETE(
      deleteRequest({ confirmation: USER_ID, password: "x" }, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("rejects a confirmation that does not match the authenticated user", async () => {
    const response = await DELETE(
      deleteRequest({ confirmation: "22222222-2222-4222-8222-222222222222", password: "x" }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("confirmation_mismatch");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password before enqueueing anything", async () => {
    verifyPassword.mockResolvedValue(false);
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "wrong" }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("reauthentication_failed");
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("requires the second factor when the account has a verified one", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
      error: null,
    });
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "x" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("mfa_required");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("runs the durable sequence in order and reports the honest status", async () => {
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "hunter2" }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      deleted: true,
      user_id: USER_ID,
      status: "auth_deleted_storage_pending",
      storage_objects_queued: 3,
      // The three queued objects are not gone yet, so this must not claim they are.
      storage_complete: false,
    });
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      "start_account_deletion",
      "mark_account_deletion_auth_pending",
    ]);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(adminRpc).toHaveBeenCalledWith("mark_account_deletion_auth_deleted", {
      p_user_id: USER_ID,
    });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("reports complete only when nothing was left queued", async () => {
    adminRpc.mockImplementation((name: string) =>
      name === "consume_auth_rate_limit"
        ? Promise.resolve({ data: { allowed: true }, error: null })
        : Promise.resolve({
            data: {
              id: "33333333-3333-4333-8333-333333333333",
              user_id: USER_ID,
              status: "complete",
              storage_objects_total: 0,
            },
            error: null,
          }),
    );
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "hunter2" }));
    const body = await response.json();
    expect(body.data.status).toBe("complete");
    expect(body.data.storage_complete).toBe(true);
  });

  it("leaves the request resumable when Auth-user deletion fails", async () => {
    deleteUser.mockResolvedValue({ error: { message: "boom" } });
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "hunter2" }));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("account_deletion_failed");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("accepts a Google-only account through its one-time challenge, not a password", async () => {
    getUser.mockResolvedValue({ data: { user: googleUser() }, error: null });
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "" }));
    expect(response.status).toBe(200);
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(consumeDeletionAuthorization).toHaveBeenCalled();
  });

  it("rejects a Google-only account whose challenge was already replayed", async () => {
    getUser.mockResolvedValue({ data: { user: googleUser() }, error: null });
    consumeDeletionAuthorization.mockResolvedValue(false);
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "" }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("reauthentication_required");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("throttles repeated attempts with a Retry-After hint", async () => {
    adminRpc.mockImplementation((name: string) =>
      name === "consume_auth_rate_limit"
        ? Promise.resolve({ data: { allowed: false, retry_after_seconds: 420 }, error: null })
        : Promise.resolve({ data: null, error: null }),
    );
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "x" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("420");
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
