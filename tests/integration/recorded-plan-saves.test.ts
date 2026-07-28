import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildRecordedPlans } from "@/lib/ai/agents/orchestrator/handlers/recorded-plans";
import type { PlanDayView } from "@/lib/ai/agents/orchestrator/answers.types";

import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  insertWardrobeItem,
  type TestUser,
} from "./helpers";

const admin = createAdminClient();

let owner: TestUser;
let stranger: TestUser;
let topId: string;
let bottomId: string;

/** A recorded planning day whose items satisfy the foundation rule. */
function planDay(date: string): PlanDayView {
  return {
    date,
    title: `Look for ${date}`,
    explanation: "Mild and dry, so a single light layer is enough.",
    confidence: 0.8,
    occasion: "work",
    items: [
      { item_id: topId, role: "top", sort_order: 0, name: "Navy shirt", category: "tops" },
      {
        item_id: bottomId,
        role: "bottom",
        sort_order: 1,
        name: "Grey chinos",
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
  };
}

/**
 * Inserts the agent_runs row the RPC replays from. Service-role insert only:
 * `agent_runs` is authenticated SELECT-only by design, so this mirrors what
 * the server records at the end of a planning turn.
 */
async function recordRun(
  userId: string,
  options: {
    intent?: string;
    status?: string;
    dates?: string[];
    plans?: unknown;
    agentType?: string;
  } = {},
) {
  const dates = options.dates ?? ["2026-08-01"];
  const plans = "plans" in options ? options.plans : buildRecordedPlans(dates.map(planDay));
  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      user_id: userId,
      agent_type: options.agentType ?? "wardrobe_orchestrator",
      status: options.status ?? "complete",
      input_summary: { intent: options.intent ?? "planning", source: "planner" },
      output_summary: plans === undefined ? {} : { plans },
      model: "test-planner-model",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to record a test agent run.");
  return data.id as string;
}

beforeAll(async () => {
  owner = await createTestUser(admin);
  stranger = await createTestUser(admin);

  const top = await insertWardrobeItem(admin, owner.id, {
    name: "Navy shirt",
    category: "tops",
    layer_role: "top",
  });
  const bottom = await insertWardrobeItem(admin, owner.id, {
    name: "Grey chinos",
    category: "bottoms",
    layer_role: "bottom",
  });
  topId = top.id;
  bottomId = bottom.id;
}, 60_000);

afterAll(async () => {
  if (owner) await deleteTestUser(admin, owner.id);
  if (stranger) await deleteTestUser(admin, stranger.id);
});

describe("saving a recorded chat plan", () => {
  it("saves every recorded day through the existing plan/outfit path", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-08-01", "2026-08-02"] });

    const { data, error } = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const planIds = (data as { plan_id: string }[]).map((entry) => entry.plan_id);
    const { data: plans } = await owner.client
      .from("outfit_plans")
      .select("id, planned_date, outfit_id")
      .in("id", planIds)
      .order("planned_date");
    expect((plans ?? []).map((row) => row.planned_date)).toEqual(["2026-08-01", "2026-08-02"]);

    // The outfit rows carry the real owned items, with their recorded roles.
    const { data: items } = await owner.client
      .from("outfit_items")
      .select("item_id, role")
      .eq("outfit_id", (plans ?? [])[0]?.outfit_id as string)
      .order("sort_order");
    expect(items).toEqual([
      { item_id: topId, role: "top" },
      { item_id: bottomId, role: "bottom" },
    ]);
  });

  it("records the mapping row for every saved plan", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-08-05"] });
    await owner.client.rpc("save_recorded_generated_week", { p_generation_id: generationId });

    const { data } = await owner.client
      .from("generated_plan_saves")
      .select("generation_id, plan_id, outfit_id, planned_date")
      .eq("generation_id", generationId);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ generation_id: generationId, planned_date: "2026-08-05" });
  });

  it("is idempotent on retry: a second call creates nothing new", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-08-10", "2026-08-11"] });

    const first = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    const second = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });

    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);

    const { count } = await owner.client
      .from("generated_plan_saves")
      .select("plan_id", { count: "exact", head: true })
      .eq("generation_id", generationId);
    expect(count).toBe(2);
  });

  it("is idempotent under concurrent saves of the same generation", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-08-15"] });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        owner.client.rpc("save_recorded_generated_week", { p_generation_id: generationId }),
      ),
    );

    const succeeded = results.filter((result) => result.error === null);
    expect(succeeded.length).toBe(5);
    // Every racing caller converges on the same plan ids.
    const serialized = new Set(succeeded.map((result) => JSON.stringify(result.data)));
    expect(serialized.size).toBe(1);

    const { count } = await owner.client
      .from("outfit_plans")
      .select("id", { count: "exact", head: true })
      .eq("planned_date", "2026-08-15");
    expect(count).toBe(1);
  });

  it("marks the stored assistant message as saved so a reload is accurate", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-08-20"] });
    const conversationId = randomUUID();
    await admin
      .from("conversations")
      .insert({ id: conversationId, user_id: owner.id, title: "Plan my week" });
    const { data: message } = await admin
      .from("messages")
      .insert({
        user_id: owner.id,
        conversation_id: conversationId,
        role: "assistant",
        content: "Here is a 1-day plan.",
        structured_result: { kind: "plan", intent: "planning", generationId, saved: false },
      })
      .select("id")
      .single();

    await owner.client.rpc("save_recorded_generated_week", { p_generation_id: generationId });

    const { data: reloaded } = await owner.client
      .from("messages")
      .select("structured_result")
      .eq("id", message?.id as string)
      .single();
    expect((reloaded?.structured_result as { saved: boolean }).saved).toBe(true);
  });

  it("leaves another conversation's plan messages untouched", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-08-22"] });
    const otherGenerationId = await recordRun(owner.id, { dates: ["2026-08-23"] });
    const conversationId = randomUUID();
    await admin
      .from("conversations")
      .insert({ id: conversationId, user_id: owner.id, title: "Other" });
    const { data: other } = await admin
      .from("messages")
      .insert({
        user_id: owner.id,
        conversation_id: conversationId,
        role: "assistant",
        content: "A different plan.",
        structured_result: {
          kind: "plan",
          intent: "planning",
          generationId: otherGenerationId,
          saved: false,
        },
      })
      .select("id")
      .single();

    await owner.client.rpc("save_recorded_generated_week", { p_generation_id: generationId });

    const { data: reloaded } = await owner.client
      .from("messages")
      .select("structured_result")
      .eq("id", other?.id as string)
      .single();
    expect((reloaded?.structured_result as { saved: boolean }).saved).toBe(false);
  });
});

describe("rejecting unsafe or unsaveable generations", () => {
  it("rejects another user's generation id", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-09-01"] });

    const { error } = await stranger.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    expect(error).not.toBeNull();

    const { count } = await admin
      .from("generated_plan_saves")
      .select("plan_id", { count: "exact", head: true })
      .eq("generation_id", generationId);
    expect(count).toBe(0);
  });

  it("rejects a packing generation", async () => {
    const generationId = await recordRun(owner.id, { intent: "packing", dates: ["2026-09-05"] });
    const { error } = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    expect(error).not.toBeNull();
  });

  it("rejects a run that recorded no plans", async () => {
    const generationId = await recordRun(owner.id, { plans: undefined });
    const { error } = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    expect(error).not.toBeNull();
  });

  it("rejects a malformed recorded plans array", async () => {
    for (const plans of [
      "not-an-array",
      [],
      [{ date: "not-a-date", items: [] }],
      [{ date: "2026-09-09", items: [] }],
      [{ date: "2026-09-09" }],
    ]) {
      const generationId = await recordRun(owner.id, { plans });
      const { error } = await owner.client.rpc("save_recorded_generated_week", {
        p_generation_id: generationId,
      });
      expect(error, `plans=${JSON.stringify(plans)} should be rejected`).not.toBeNull();
    }
  });

  it("rejects a window longer than seven days", async () => {
    const dates = Array.from({ length: 8 }, (_unused, index) => `2026-10-0${index + 1}`);
    const generationId = await recordRun(owner.id, { dates });
    const { error } = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    expect(error).not.toBeNull();
  });

  it("rejects an incomplete or non-orchestrator run", async () => {
    const running = await recordRun(owner.id, { status: "running", dates: ["2026-09-12"] });
    expect(
      (await owner.client.rpc("save_recorded_generated_week", { p_generation_id: running })).error,
    ).not.toBeNull();

    const otherAgent = await recordRun(owner.id, {
      agentType: "planner_agent",
      dates: ["2026-09-13"],
    });
    expect(
      (await owner.client.rpc("save_recorded_generated_week", { p_generation_id: otherAgent }))
        .error,
    ).not.toBeNull();
  });

  it("rejects a null generation id", async () => {
    const { error } = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: null,
    });
    expect(error).not.toBeNull();
  });

  it("rolls back every day atomically when one item is no longer available", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-11-01", "2026-11-02"] });
    // The second day's item goes to the laundry after the plan was generated.
    await admin
      .from("wardrobe_items")
      .update({ availability_status: "laundry" })
      .eq("id", bottomId);

    const { error } = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    expect(error).not.toBeNull();

    // Nothing at all was created -- not even the first, still-valid day.
    const { count: planCount } = await admin
      .from("outfit_plans")
      .select("id", { count: "exact", head: true })
      .in("planned_date", ["2026-11-01", "2026-11-02"]);
    expect(planCount).toBe(0);

    const { count: saveCount } = await admin
      .from("generated_plan_saves")
      .select("plan_id", { count: "exact", head: true })
      .eq("generation_id", generationId);
    expect(saveCount).toBe(0);

    await admin
      .from("wardrobe_items")
      .update({ availability_status: "available" })
      .eq("id", bottomId);
  });

  it("rejects an archived item the same way", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-11-10"] });
    await admin.from("wardrobe_items").update({ status: "archived" }).eq("id", topId);

    const { error } = await owner.client.rpc("save_recorded_generated_week", {
      p_generation_id: generationId,
    });
    expect(error).not.toBeNull();

    await admin.from("wardrobe_items").update({ status: "active" }).eq("id", topId);
  });
});

describe("generated_plan_saves row-level security", () => {
  it("lets the owner read only their own save rows", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-12-01"] });
    await owner.client.rpc("save_recorded_generated_week", { p_generation_id: generationId });

    const { data: mine } = await owner.client
      .from("generated_plan_saves")
      .select("generation_id")
      .eq("generation_id", generationId);
    expect(mine).toHaveLength(1);

    const { data: theirs } = await stranger.client
      .from("generated_plan_saves")
      .select("generation_id")
      .eq("generation_id", generationId);
    expect(theirs ?? []).toHaveLength(0);
  });

  it("refuses direct authenticated writes, leaving the RPC as the only path", async () => {
    const generationId = await recordRun(owner.id, { dates: ["2026-12-05"] });

    const inserted = await owner.client.from("generated_plan_saves").insert({
      user_id: owner.id,
      generation_id: generationId,
      plan_id: randomUUID(),
      outfit_id: randomUUID(),
      planned_date: "2026-12-05",
    });
    expect(inserted.error).not.toBeNull();

    const updated = await owner.client
      .from("generated_plan_saves")
      .update({ planned_date: "2026-12-06" })
      .eq("generation_id", generationId);
    expect(updated.error).not.toBeNull();

    const deleted = await owner.client
      .from("generated_plan_saves")
      .delete()
      .eq("generation_id", generationId);
    expect(deleted.error).not.toBeNull();
  });
});
