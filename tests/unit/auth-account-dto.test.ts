import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { applyAuthTestEnvironment } from "./auth-test-env";

applyAuthTestEnvironment();

const { buildAccountSecurity } = await import("@/app/api/account/security/build-dto");
const { buildAccountExport } = await import("@/app/api/account/export/build-export");

const getAuthenticatorAssuranceLevel = vi.fn();
const listFactors = vi.fn();
const rpc = vi.fn();
const order = vi.fn();

function client(): SupabaseClient {
  return {
    auth: { mfa: { getAuthenticatorAssuranceLevel, listFactors } },
    rpc,
    from: () => ({ select: () => ({ order }) }),
  } as unknown as SupabaseClient;
}

/** A provider user carrying every field we must *not* pass on. */
function noisyUser(): User {
  return {
    id: "u1",
    email: "sam@example.test",
    email_confirmed_at: "2026-02-02T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-07-20T00:00:00Z",
    new_email: "new@example.test",
    identities: [
      {
        identity_id: "e1",
        id: "sub-1",
        user_id: "u1",
        provider: "email",
        created_at: "2026-01-01T00:00:00Z",
        last_sign_in_at: "2026-07-20T00:00:00Z",
        identity_data: { sub: "provider-subject", avatar_url: "https://cdn.example/a.png" },
      },
    ],
    app_metadata: { providers: ["email"], internal_flag: "do-not-leak" },
    user_metadata: { first_name: "Sam", secret_note: "do-not-leak" },
    factors: [{ id: "f1", status: "verified", secret: "TOTPSECRET" }],
  } as unknown as User;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2", nextLevel: "aal2", currentAuthenticationMethods: [] },
    error: null,
  });
  listFactors.mockResolvedValue({
    data: {
      all: [],
      totp: [{ id: "f1", friendly_name: "Phone", created_at: "2026-03-03T00:00:00Z" }],
    },
    error: null,
  });
  rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "export_my_visualization_data"
        ? { data: { outfit_visualizations: [], profile_identity_references: [] }, error: null }
        : { data: { schema_version: 1, wardrobe_items: [] }, error: null },
    ),
  );
  order.mockResolvedValue({
    data: [{ terms_version: "2026-07-28", privacy_version: "2026-07-28", source: "signup" }],
    error: null,
  });
});

describe("account security DTO", () => {
  it("reports the real email, confirmation state, and pending change", async () => {
    const dto = await buildAccountSecurity(client(), noisyUser());
    expect(dto.email).toBe("sam@example.test");
    expect(dto.emailConfirmed).toBe(true);
    expect(dto.pendingEmail).toBe("new@example.test");
    expect(dto.hasPassword).toBe(true);
    expect(dto.mfaEnabled).toBe(true);
    expect(dto.assuranceLevel).toBe("aal2");
  });

  it("carries no provider metadata, identity payloads, or factor secrets", async () => {
    const serialized = JSON.stringify(await buildAccountSecurity(client(), noisyUser()));
    expect(serialized).not.toContain("do-not-leak");
    expect(serialized).not.toContain("provider-subject");
    expect(serialized).not.toContain("avatar_url");
    expect(serialized).not.toContain("TOTPSECRET");
    expect(serialized).not.toContain("app_metadata");
  });

  it("reports how this session authenticated, without the claim's timestamps", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: {
        currentLevel: "aal2",
        nextLevel: "aal2",
        currentAuthenticationMethods: [
          { method: "password", timestamp: 1_800_000_000 },
          { method: "totp", timestamp: 1_800_000_100 },
        ],
      },
      error: null,
    });
    const dto = await buildAccountSecurity(client(), noisyUser());
    expect(dto.currentAuthenticationMethods).toEqual(["password", "totp"]);
    expect(JSON.stringify(dto)).not.toContain("1800000000");
  });

  it("handles the RFC-8176 string form of the claim too", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: ["password"] },
      error: null,
    });
    const dto = await buildAccountSecurity(client(), noisyUser());
    expect(dto.currentAuthenticationMethods).toEqual(["password"]);
  });

  it("reduces a factor to an id, a name, and a date", async () => {
    const dto = await buildAccountSecurity(client(), noisyUser());
    expect(dto.factors).toEqual([
      { id: "f1", friendlyName: "Phone", createdAt: "2026-03-03T00:00:00Z" },
    ]);
  });
});

describe("account export", () => {
  it("adds account and consent metadata and bumps the schema version", async () => {
    const result = await buildAccountExport(client(), noisyUser());
    expect(result.schema_version).toBe(3);
    expect(result.account).toMatchObject({
      user_id: "u1",
      email: "sam@example.test",
      email_confirmed_at: "2026-02-02T00:00:00Z",
      mfa_enabled: true,
    });
    expect(result.account.providers).toEqual([
      {
        provider: "email",
        created_at: "2026-01-01T00:00:00Z",
        last_sign_in_at: "2026-07-20T00:00:00Z",
      },
    ]);
    expect(result.legal_acceptances).toHaveLength(1);
  });

  it("keeps the relational payload from the RLS-bound RPC", async () => {
    const result = (await buildAccountExport(client(), noisyUser())) as Record<string, unknown>;
    expect(result.wardrobe_items).toEqual([]);
  });

  it("includes the Outfit Studio tables from their own RLS-bound RPC", async () => {
    const result = (await buildAccountExport(client(), noisyUser())) as Record<string, unknown>;
    expect(result.outfit_visualizations).toEqual([]);
    expect(result.profile_identity_references).toEqual([]);
  });

  it("contains no tokens, secrets, or raw provider payloads", async () => {
    const serialized = JSON.stringify(await buildAccountExport(client(), noisyUser()));
    for (const forbidden of [
      "do-not-leak",
      "provider-subject",
      "TOTPSECRET",
      "access_token",
      "refresh_token",
      "password_hash",
      "identity_data",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
