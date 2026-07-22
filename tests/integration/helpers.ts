import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireIntegrationEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Integration tests need a local Supabase instance: run ` +
        `\`npx supabase start\`, then \`npm run test:integration\` (which reads ` +
        `\`npx supabase status -o env\` automatically via vitest.integration.config.ts).`,
    );
  }
  return value;
}

export function integrationEnv() {
  return {
    url: requireIntegrationEnv("TEST_SUPABASE_URL"),
    anonKey: requireIntegrationEnv("TEST_SUPABASE_ANON_KEY"),
    serviceRoleKey: requireIntegrationEnv("TEST_SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function createAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = integrationEnv();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/**
 * Creates a real auth user (so the on_auth_user_created_wardrobe trigger
 * creates its profiles row) and returns a client authenticated as that user,
 * so RPCs that read auth.uid() (request_wardrobe_recompilation,
 * consume_rate_limit, the user_select RLS policies) behave exactly as they
 * would for a real signed-in browser session -- not the service-role client,
 * which has no auth.uid() and bypasses RLS entirely.
 */
export async function createTestUser(admin: SupabaseClient): Promise<TestUser> {
  const email = `wardrobe-compilation-test-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw createError ?? new Error("Failed to create integration test user.");
  }

  const { url, anonKey } = integrationEnv();
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !session.session) {
    throw signInError ?? new Error("Failed to sign in integration test user.");
  }

  return { id: created.user.id, email, client };
}

export async function deleteTestUser(admin: SupabaseClient, userId: string) {
  // Cascades through virtually every user-owned table (see docs/data-model.md),
  // including wardrobe_compilation_state/jobs/outfit_candidates.
  await admin.auth.admin.deleteUser(userId);
}

export interface WardrobeItemOverrides {
  name?: string;
  category?: string;
  layer_role?: "top" | "bottom" | "dress" | "layer" | "shoes" | "accessory";
  warmth_level?: number | null;
  formality_level?: number | null;
  water_resistance?: string | null;
  occasion_tags?: string[];
  status?: string;
  availability_status?: string;
}

export async function insertWardrobeItem(
  admin: SupabaseClient,
  userId: string,
  overrides: WardrobeItemOverrides = {},
) {
  const { data, error } = await admin
    .from("wardrobe_items")
    .insert({
      user_id: userId,
      name: overrides.name ?? "Integration test item",
      category: overrides.category ?? "tops",
      layer_role: overrides.layer_role ?? "top",
      primary_color_hex: "#1b2a4a",
      color_names: ["navy"],
      warmth_level: overrides.warmth_level ?? 2,
      formality_level: overrides.formality_level ?? 3,
      water_resistance: overrides.water_resistance ?? null,
      occasion_tags: overrides.occasion_tags ?? [],
      metadata_confidence: 0.9,
      status: overrides.status ?? "active",
      availability_status: overrides.availability_status ?? "available",
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Failed to insert a test wardrobe item.");
  return data as Record<string, unknown> & { id: string };
}
