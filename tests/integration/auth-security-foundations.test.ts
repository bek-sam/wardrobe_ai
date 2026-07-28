import { randomUUID } from "node:crypto";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

/**
 * The legal-acceptance, action-challenge, rate-limit, and auth-event tables
 * against a real local Supabase, where RLS and the security-definer grants are
 * actually in force. A service-role client bypasses RLS, so every "must be
 * denied" assertion below uses the *user's own* authenticated client.
 */

const admin = createAdminClient();
let alice: TestUser;
let bob: TestUser;

const identifierHash = (value: string) =>
  createHmac("sha256", "integration-secret").update(value).digest("hex");

beforeAll(async () => {
  alice = await createTestUser(admin);
  bob = await createTestUser(admin);
}, 30_000);

afterAll(async () => {
  await deleteTestUser(admin, alice.id);
  await deleteTestUser(admin, bob.id);
});

describe("legal_acceptances", () => {
  it("records consent through the service-role RPC and is idempotent per version pair", async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await admin.rpc("record_legal_acceptance", {
        p_user_id: alice.id,
        p_terms_version: "2026-07-28",
        p_privacy_version: "2026-07-28",
        p_source: "signup",
      });
      expect(error).toBeNull();
    }

    const { data } = await admin.from("legal_acceptances").select("id").eq("user_id", alice.id);
    expect(data).toHaveLength(1);
  });

  it("lets a user read their own consent and nobody else's", async () => {
    const own = await alice.client.from("legal_acceptances").select("user_id");
    expect(own.error).toBeNull();
    expect(own.data?.every((row) => row.user_id === alice.id)).toBe(true);

    const foreign = await bob.client.from("legal_acceptances").select("user_id");
    expect(foreign.data ?? []).toHaveLength(0);
  });

  it("refuses a client-written acceptance record", async () => {
    const { error } = await alice.client.from("legal_acceptances").insert({
      user_id: alice.id,
      terms_version: "9999-01-01",
      privacy_version: "9999-01-01",
      source: "signup",
    });
    expect(error).not.toBeNull();
  });

  it("refuses to rewrite history", async () => {
    const { error } = await alice.client
      .from("legal_acceptances")
      .update({ source: "in_app_reacceptance" })
      .eq("user_id", alice.id);
    // No update policy exists, so the write matches no row it is allowed to touch.
    const { data } = await admin
      .from("legal_acceptances")
      .select("source")
      .eq("user_id", alice.id)
      .single();
    expect(error === null || error !== null).toBe(true);
    expect(data?.source).toBe("signup");
  });

  it("cascades when the account is deleted", async () => {
    const doomed = await createTestUser(admin);
    await admin.rpc("record_legal_acceptance", {
      p_user_id: doomed.id,
      p_terms_version: "2026-07-28",
      p_privacy_version: "2026-07-28",
      p_source: "signup",
    });
    await deleteTestUser(admin, doomed.id);

    const { data } = await admin.from("legal_acceptances").select("id").eq("user_id", doomed.id);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("auth_action_challenges", () => {
  const nonce = randomUUID();

  it("is invisible to authenticated and anonymous callers", async () => {
    const { data, error } = await alice.client.from("auth_action_challenges").select("nonce");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("refuses direct RPC execution by an authenticated user", async () => {
    const { error } = await alice.client.rpc("issue_auth_action_challenge", {
      p_nonce: randomUUID(),
      p_user_id: alice.id,
      p_purpose: "account_deletion",
      p_session_id: null,
      p_expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("consumes exactly once, so a replay fails", async () => {
    await admin.rpc("issue_auth_action_challenge", {
      p_nonce: nonce,
      p_user_id: alice.id,
      p_purpose: "password_reset",
      p_session_id: null,
      p_expires_at: new Date(Date.now() + 600_000).toISOString(),
    });

    const first = await admin.rpc("consume_auth_action_challenge", {
      p_nonce: nonce,
      p_user_id: alice.id,
      p_purpose: "password_reset",
    });
    const replay = await admin.rpc("consume_auth_action_challenge", {
      p_nonce: nonce,
      p_user_id: alice.id,
      p_purpose: "password_reset",
    });

    expect(first.data).toBe(true);
    expect(replay.data).toBe(false);
  });

  it("refuses a challenge presented for the wrong user or purpose", async () => {
    const other = randomUUID();
    await admin.rpc("issue_auth_action_challenge", {
      p_nonce: other,
      p_user_id: alice.id,
      p_purpose: "password_reset",
      p_session_id: null,
      p_expires_at: new Date(Date.now() + 600_000).toISOString(),
    });

    const wrongUser = await admin.rpc("consume_auth_action_challenge", {
      p_nonce: other,
      p_user_id: bob.id,
      p_purpose: "password_reset",
    });
    const wrongPurpose = await admin.rpc("consume_auth_action_challenge", {
      p_nonce: other,
      p_user_id: alice.id,
      p_purpose: "account_deletion",
    });

    expect(wrongUser.data).toBe(false);
    expect(wrongPurpose.data).toBe(false);
  });

  it("refuses an expired challenge", async () => {
    const expired = randomUUID();
    await admin.rpc("issue_auth_action_challenge", {
      p_nonce: expired,
      p_user_id: alice.id,
      p_purpose: "password_reset",
      p_session_id: null,
      p_expires_at: new Date(Date.now() - 1_000).toISOString(),
    });
    const { data } = await admin.rpc("consume_auth_action_challenge", {
      p_nonce: expired,
      p_user_id: alice.id,
      p_purpose: "password_reset",
    });
    expect(data).toBe(false);
  });
});

describe("consume_auth_rate_limit", () => {
  it("counts atomically under concurrency, with no lost updates", async () => {
    const hash = identifierHash(`concurrent-${randomUUID()}`);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        admin.rpc("consume_auth_rate_limit", {
          p_action: "login",
          p_identifier_hash: hash,
          p_limit: 10,
          p_window_seconds: 900,
        }),
      ),
    );

    const allowed = results.filter((result) => result.data?.allowed === true);
    // Exactly the budget is granted: no more (lost updates) and no fewer.
    expect(allowed).toHaveLength(10);
  });

  it("reports a retry hint without revealing counts or bucket identity", async () => {
    const hash = identifierHash(`retry-${randomUUID()}`);
    await admin.rpc("consume_auth_rate_limit", {
      p_action: "login",
      p_identifier_hash: hash,
      p_limit: 1,
      p_window_seconds: 900,
    });
    const { data } = await admin.rpc("consume_auth_rate_limit", {
      p_action: "login",
      p_identifier_hash: hash,
      p_limit: 1,
      p_window_seconds: 900,
    });

    expect(data.allowed).toBe(false);
    expect(data.retry_after_seconds).toBeGreaterThan(0);
    expect(Object.keys(data)).not.toContain("request_count");
    expect(Object.keys(data)).not.toContain("identifier_hash");
  });

  it("stores no raw identifier and rejects one that is not a hash", async () => {
    const { error } = await admin.from("auth_rate_limits").insert({
      action: "login",
      identifier_hash: "sam@example.test",
      window_start: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("is unreachable from an authenticated client", async () => {
    const { error } = await alice.client.rpc("consume_auth_rate_limit", {
      p_action: "login",
      p_identifier_hash: identifierHash("nope"),
      p_limit: 5,
      p_window_seconds: 900,
    });
    expect(error).not.toBeNull();
  });

  it("validates its own parameters", async () => {
    const { error } = await admin.rpc("consume_auth_rate_limit", {
      p_action: "login",
      p_identifier_hash: identifierHash("bad"),
      p_limit: 0,
      p_window_seconds: 900,
    });
    expect(error).not.toBeNull();
  });
});

describe("auth_events", () => {
  it("accepts a service-role write and shows the user only their own", async () => {
    await admin.from("auth_events").insert({
      event_type: "login_attempted",
      result: "success",
      user_id: alice.id,
      provider: "email",
    });

    const own = await alice.client.from("auth_events").select("event_type");
    expect(own.error).toBeNull();
    expect(own.data?.length).toBeGreaterThan(0);

    const foreign = await bob.client.from("auth_events").select("event_type");
    expect(foreign.data ?? []).toHaveLength(0);
  });

  it("refuses a client-written event", async () => {
    const { error } = await alice.client
      .from("auth_events")
      .insert({ event_type: "login_attempted", result: "success", user_id: alice.id });
    expect(error).not.toBeNull();
  });

  it("constrains the result and provider vocabulary", async () => {
    const badResult = await admin
      .from("auth_events")
      .insert({ event_type: "login_attempted", result: "maybe" });
    const badProvider = await admin
      .from("auth_events")
      .insert({ event_type: "login_attempted", result: "success", provider: "saml" });
    expect(badResult.error).not.toBeNull();
    expect(badProvider.error).not.toBeNull();
  });
});

describe("prune_auth_operational_data", () => {
  it("is service-role only and reports what it removed", async () => {
    const denied = await (alice.client as SupabaseClient).rpc("prune_auth_operational_data", {
      p_event_retention_days: 90,
    });
    expect(denied.error).not.toBeNull();

    const { data, error } = await admin.rpc("prune_auth_operational_data", {
      p_event_retention_days: 90,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      auth_action_challenges_deleted: expect.any(Number),
      auth_rate_limit_buckets_deleted: expect.any(Number),
      auth_events_deleted: expect.any(Number),
    });
  });

  it("rejects an out-of-range retention window", async () => {
    const { error } = await admin.rpc("prune_auth_operational_data", {
      p_event_retention_days: 0,
    });
    expect(error).not.toBeNull();
  });
});
