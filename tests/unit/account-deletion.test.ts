import { beforeEach, describe, expect, it, vi } from "vitest";

const requireViewer = vi.fn();
vi.mock("@/lib/auth/viewer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/viewer")>();
  return { ...actual, requireViewer: () => requireViewer() };
});

const signInWithPassword = vi.fn();
const rpc = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword, signOut },
    rpc,
  }),
}));

const deleteUser = vi.fn();
const updateEq2 = vi.fn();
const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
const update = vi.fn(() => ({ eq: updateEq1 }));
const from = vi.fn(() => ({ update }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser } },
    from,
  }),
}));

const { DELETE } = await import("@/app/api/account/route");

const APP_URL = "http://localhost:3000";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function deleteRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(new URL("/api/account", APP_URL), {
    method: "DELETE",
    headers: { origin: APP_URL, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireViewer.mockResolvedValue({ id: USER_ID, email: "user@example.com" });
    signInWithPassword.mockResolvedValue({ error: null });
    rpc.mockImplementation((name: string) => {
      if (name === "start_account_deletion") {
        return Promise.resolve({
          data: {
            id: "33333333-3333-4333-8333-333333333333",
            user_id: USER_ID,
            status: "storage_deletion_queued",
            storage_objects_total: 3,
          },
          error: null,
        });
      }
      if (name === "mark_account_deletion_auth_pending") {
        return Promise.resolve({
          data: {
            id: "33333333-3333-4333-8333-333333333333",
            user_id: USER_ID,
            status: "deleting_auth_user",
            storage_objects_total: 3,
          },
          error: null,
        });
      }
      throw new Error(`unexpected rpc: ${name}`);
    });
    deleteUser.mockResolvedValue({ error: null });
    updateEq2.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("rejects a forged cross-origin request before touching auth", async () => {
    const response = await DELETE(
      deleteRequest(
        { confirmation: USER_ID, password: "hunter2" },
        { origin: "https://evil.example" },
      ),
    );
    expect(response.status).toBe(403);
    expect(requireViewer).not.toHaveBeenCalled();
  });

  it("rejects a confirmation that does not match the authenticated user", async () => {
    const response = await DELETE(
      deleteRequest({ confirmation: "22222222-2222-4222-8222-222222222222", password: "hunter2" }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("confirmation_mismatch");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects deletion when the account has no password to re-verify", async () => {
    requireViewer.mockResolvedValue({ id: USER_ID, email: null });
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "hunter2" }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("reauthentication_unavailable");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password before enqueueing anything", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "wrong" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("reauthentication_failed");
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("runs the durable deletion sequence in order and reports queued storage objects", async () => {
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "hunter2" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ deleted: true, user_id: USER_ID, storage_objects_queued: 3 });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "hunter2",
    });
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      "start_account_deletion",
      "mark_account_deletion_auth_pending",
    ]);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(from).toHaveBeenCalledWith("account_deletion_requests");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "complete", completed_at: expect.any(String) }),
    );
    expect(updateEq1).toHaveBeenCalledWith("user_id", USER_ID);
    expect(updateEq2).toHaveBeenCalledWith("status", "deleting_auth_user");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("leaves the request resumable and does not mark it complete when Auth-user deletion fails", async () => {
    deleteUser.mockResolvedValue({ error: { message: "boom" } });
    const response = await DELETE(deleteRequest({ confirmation: USER_ID, password: "hunter2" }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("account_deletion_failed");
    expect(update).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
