import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Seeding for the authenticated E2E run. Everything here talks to the local
 * Supabase instance with the service-role key, which is exactly what a
 * developer machine and CI have; no OpenAI key is involved, because the
 * routes these specs exercise are deterministic.
 */
export function e2eSupabaseConfig() {
  const url = process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export function adminClient(): SupabaseClient {
  const config = e2eSupabaseConfig();
  if (!config) throw new Error("Local Supabase env is not configured for the E2E run.");
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type SeededUser = { id: string; email: string; password: string };

/** A disposable, email-confirmed user that can log in through the real UI. */
export async function createDisposableUser(admin: SupabaseClient): Promise<SeededUser> {
  const email = `wardrobe-e2e-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Failed to create the E2E user.");
  return { id: data.user.id, email, password };
}

export async function deleteDisposableUser(admin: SupabaseClient, userId: string) {
  await admin.auth.admin.deleteUser(userId);
}

type ItemSeed = {
  name: string;
  category: string;
  layerRole: "top" | "bottom" | "dress" | "layer" | "shoes" | "accessory";
  colorNames: string[];
  wearCount?: number;
  lastWornAt?: string | null;
};

export async function seedItem(admin: SupabaseClient, userId: string, seed: ItemSeed) {
  const { data, error } = await admin
    .from("wardrobe_items")
    .insert({
      user_id: userId,
      name: seed.name,
      category: seed.category,
      layer_role: seed.layerRole,
      primary_color_hex: "#1b2a4a",
      color_names: seed.colorNames,
      warmth_level: 2,
      formality_level: 3,
      occasion_tags: [],
      metadata_confidence: 0.9,
      status: "active",
      availability_status: "available",
      wear_count: seed.wearCount ?? 0,
      last_worn_at: seed.lastWornAt ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`Failed to seed item ${seed.name}.`);
  return data.id as string;
}

/**
 * Seeds the blue blazer the item-lookup spec asks about, plus a never-worn
 * piece so the insight spec has real wear history to compute against.
 */
export async function seedWardrobe(admin: SupabaseClient, userId: string) {
  const blazerId = await seedItem(admin, userId, {
    name: "Blue blazer",
    category: "outerwear",
    layerRole: "layer",
    colorNames: ["blue"],
    wearCount: 4,
    lastWornAt: "2026-07-20",
  });
  const topId = await seedItem(admin, userId, {
    name: "Navy shirt",
    category: "tops",
    layerRole: "top",
    colorNames: ["navy"],
    wearCount: 2,
    lastWornAt: "2026-07-18",
  });
  const bottomId = await seedItem(admin, userId, {
    name: "Green corduroy trousers",
    category: "bottoms",
    layerRole: "bottom",
    colorNames: ["green"],
    wearCount: 0,
    lastWornAt: null,
  });
  return { blazerId, topId, bottomId };
}

/**
 * Records a completed planning run and the assistant message that references
 * it, so the save-plan UI can be exercised without a real planner model call.
 * The recorded shape is exactly what the orchestrator writes in production.
 */
export async function seedRecordedPlan(
  admin: SupabaseClient,
  userId: string,
  items: { topId: string; bottomId: string },
  date = "2026-08-01",
) {
  const plans = [
    {
      date,
      occasion: "work",
      weather_context: {
        locationName: "Berlin",
        minimumTemperatureC: 14,
        maximumTemperatureC: 23,
        precipitationProbability: 10,
        tags: ["mild"],
      },
      name: `Look for ${date}`,
      explanation: "Mild and dry, so a single light layer is enough.",
      confidence: 0.8,
      items: [
        { item_id: items.topId, role: "top", sort_order: 0 },
        { item_id: items.bottomId, role: "bottom", sort_order: 1 },
      ],
    },
  ];

  const { data: run, error: runError } = await admin
    .from("agent_runs")
    .insert({
      user_id: userId,
      agent_type: "wardrobe_orchestrator",
      status: "complete",
      input_summary: { intent: "planning", source: "planner", startDate: date, endDate: date },
      output_summary: { plans, dates: [date] },
      model: "seeded-planner-model",
    })
    .select("id")
    .single();
  if (runError || !run) throw runError ?? new Error("Failed to seed the planning run.");

  const conversationId = randomUUID();
  const { error: conversationError } = await admin
    .from("conversations")
    .insert({ id: conversationId, user_id: userId, title: "Plan my week" });
  if (conversationError) throw conversationError;

  const structuredResult = {
    kind: "plan",
    intent: "planning",
    generationId: run.id as string,
    answer:
      "Here is a 1-day plan, built only from items you own and each day's forecast. " +
      "It was not saved automatically — use “Save plan” below to keep it.",
    startDate: date,
    endDate: date,
    dayCount: 1,
    days: [
      {
        date,
        title: `Look for ${date}`,
        explanation: "Mild and dry, so a single light layer is enough.",
        confidence: 0.8,
        occasion: "work",
        items: [
          {
            item_id: items.topId,
            role: "top",
            sort_order: 0,
            name: "Navy shirt",
            category: "tops",
          },
          {
            item_id: items.bottomId,
            role: "bottom",
            sort_order: 1,
            name: "Green corduroy trousers",
            category: "bottoms",
          },
        ],
        weather: {
          locationName: "Berlin",
          minimumTemperatureC: 14,
          maximumTemperatureC: 23,
          precipitationProbability: 10,
          tags: ["mild"],
        },
      },
    ],
    missingCategories: [],
    saved: false,
  };

  const { error: messageError } = await admin.from("messages").insert([
    {
      user_id: userId,
      conversation_id: conversationId,
      role: "user",
      content: "Plan my outfits for next week",
      structured_result: null,
    },
    {
      user_id: userId,
      conversation_id: conversationId,
      role: "assistant",
      content: structuredResult.answer,
      structured_result: structuredResult,
    },
  ]);
  if (messageError) throw messageError;

  return { generationId: run.id as string, conversationId };
}
