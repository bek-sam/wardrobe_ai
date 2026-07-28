import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { generateTotp } from "../support/totp";
import { createAdminClient, integrationEnv } from "./helpers";

/**
 * MFA has to be a real authorization boundary, not a redirect.
 *
 * The setup mirrors the threat exactly: a factor is enrolled and verified for
 * real through the SDK, then a *fresh* password sign-in produces a token that
 * has satisfied only the first factor — which is what someone with a stolen
 * password would hold. That token is then pointed straight at PostgREST and
 * Storage, bypassing the application entirely.
 *
 * A second user with no factor proves the restriction does not simply break
 * everyone: they keep full access at aal1.
 */

const admin = createAdminClient();

type Actor = { id: string; email: string; password: string; client: SupabaseClient };

async function createActor(): Promise<Actor> {
  const email = `mfa-rls-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Failed to create MFA test user.");
  return { id: data.user.id, email, password, client: await signIn(email, password) };
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const { url, anonKey } = integrationEnv();
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

let plain: Actor;
let enrolled: Actor;
/** Same account as `enrolled`, but a token issued after the first factor only. */
let underAssured: SupabaseClient;
let enrolledItemId: string;

beforeAll(async () => {
  plain = await createActor();
  enrolled = await createActor();

  const { data: item, error: itemError } = await admin
    .from("wardrobe_items")
    .insert({
      user_id: enrolled.id,
      name: "Enrolled user's coat",
      category: "outerwear",
      layer_role: "layer",
    })
    .select("id")
    .single();
  if (itemError) throw itemError;
  enrolledItemId = item.id;

  const { data: enrollment, error: enrollError } = await enrolled.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Integration authenticator",
  });
  if (enrollError || !enrollment) throw enrollError ?? new Error("Enrollment failed.");

  const { error: verifyError } = await enrolled.client.auth.mfa.challengeAndVerify({
    factorId: enrollment.id,
    code: generateTotp(enrollment.totp.secret),
  });
  if (verifyError) throw verifyError;

  // Now the account has a verified factor, so a fresh password sign-in yields
  // an aal1 token: the attacker's view.
  underAssured = await signIn(enrolled.email, enrolled.password);
}, 60_000);

afterAll(async () => {
  await admin.auth.admin.deleteUser(plain.id);
  await admin.auth.admin.deleteUser(enrolled.id);
});

describe("a user with no verified factor", () => {
  it("reads and writes their own rows at aal1", async () => {
    const inserted = await plain.client
      .from("wardrobe_items")
      .insert({ user_id: plain.id, name: "Plain tee", category: "tops", layer_role: "top" })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();

    const read = await plain.client.from("wardrobe_items").select("id");
    expect(read.error).toBeNull();
    expect(read.data?.length).toBeGreaterThan(0);
  });

  it("still cannot reach another user's rows", async () => {
    const { data } = await plain.client
      .from("wardrobe_items")
      .select("id")
      .eq("id", enrolledItemId);
    expect(data ?? []).toHaveLength(0);
  });

  it("can use their own private Storage prefix", async () => {
    const { error } = await plain.client.storage
      .from("wardrobe-originals")
      .upload(`${plain.id}/allowed-${randomUUID()}.bin`, new Blob([new Uint8Array([1])]));
    expect(error).toBeNull();
  });
});

describe("an MFA-enrolled account holding an aal1 token", () => {
  it("cannot read its own private rows", async () => {
    const { data } = await underAssured.from("wardrobe_items").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read its own profile", async () => {
    const { data } = await underAssured.from("profiles").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot mutate its own rows", async () => {
    await underAssured
      .from("wardrobe_items")
      .update({ name: "renamed by an under-assured session" })
      .eq("id", enrolledItemId);
    const { data } = await admin
      .from("wardrobe_items")
      .select("name")
      .eq("id", enrolledItemId)
      .single();
    expect(data?.name).toBe("Enrolled user's coat");
  });

  it("cannot insert new rows", async () => {
    const { error } = await underAssured
      .from("wardrobe_items")
      .insert({ user_id: enrolled.id, name: "Smuggled", category: "tops", layer_role: "top" });
    expect(error).not.toBeNull();
  });

  it("cannot upload to its own private Storage prefix", async () => {
    const { error } = await underAssured.storage
      .from("wardrobe-originals")
      .upload(`${enrolled.id}/blocked-${randomUUID()}.bin`, new Blob([new Uint8Array([1, 2, 3])]));
    expect(error).not.toBeNull();
  });

  it("cannot start an account deletion", async () => {
    const { error } = await underAssured.rpc("start_account_deletion");
    expect(error).not.toBeNull();
  });

  it("can still list its own factors, so the challenge remains reachable", async () => {
    const { data, error } = await underAssured.auth.mfa.listFactors();
    expect(error).toBeNull();
    expect(data?.totp?.length).toBeGreaterThan(0);
  });
});

describe("the same account once it reaches aal2", () => {
  it("reads its own rows again", async () => {
    const { data, error } = await enrolled.client
      .from("wardrobe_items")
      .select("id")
      .eq("id", enrolledItemId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("uses its own private Storage again", async () => {
    const { error } = await enrolled.client.storage
      .from("wardrobe-originals")
      .upload(`${enrolled.id}/allowed-${randomUUID()}.bin`, new Blob([new Uint8Array([9])]));
    expect(error).toBeNull();
  });
});

describe("service-role workers", () => {
  it("keep full access regardless of any user's assurance level", async () => {
    const { data, error } = await admin
      .from("wardrobe_items")
      .select("id")
      .eq("id", enrolledItemId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("can still claim storage-deletion work", async () => {
    const { error } = await admin.rpc("claim_storage_deletion_tasks", {
      p_limit: 1,
      p_lease_seconds: 60,
    });
    expect(error).toBeNull();
  });
});

describe("anonymous callers", () => {
  it("are denied on every user-owned table", async () => {
    const { url, anonKey } = integrationEnv();
    const anonymous = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    for (const table of ["wardrobe_items", "profiles", "legal_acceptances", "auth_events"]) {
      const { data } = await anonymous.from(table).select("*").limit(1);
      expect(data ?? []).toHaveLength(0);
    }
  });
});
