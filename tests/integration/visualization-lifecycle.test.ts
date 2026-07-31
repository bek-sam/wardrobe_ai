import { afterAll, describe, expect, it } from "vitest";

import { createAdminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";
import {
  CONSENT_VERSION,
  GENERATION_CONFIG,
  seedFoundation,
  seedIdentityReference,
  snapshotItems,
} from "./visualization-helpers";

const admin = createAdminClient();
const createdUserIds: string[] = [];

async function freshUser(): Promise<TestUser> {
  const user = await createTestUser(admin);
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  await Promise.all(createdUserIds.map((id) => deleteTestUser(admin, id)));
});

type RequestResult = {
  outcome: string;
  visualization_id?: string;
  status?: string;
  reason?: string;
  reset_at?: string | null;
};

async function requestVisualization(user: TestUser, hash: string, items: unknown) {
  const { data, error } = await user.client.rpc("request_outfit_visualization", {
    p_source_kind: "composition",
    p_source_id: null,
    p_source_hash: hash,
    p_items: items,
    ...GENERATION_CONFIG,
  });
  if (error) throw error;
  return data as RequestResult;
}

describe("request_outfit_visualization", () => {
  it("refuses without an active identity reference", async () => {
    const user = await freshUser();
    const { top, bottom } = await seedFoundation(admin, user.id);
    const result = await requestVisualization(
      user,
      "a".repeat(64),
      snapshotItems(user.id, top.id, bottom.id),
    );
    expect(result.outcome).toBe("needs_identity");
  });

  it("creates a visualization, its snapshot, and exactly one job", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);

    const result = await requestVisualization(
      user,
      "b".repeat(64),
      snapshotItems(user.id, top.id, bottom.id),
    );
    expect(result.outcome).toBe("created");
    expect(result.status).toBe("queued");

    const { data: items } = await admin
      .from("outfit_visualization_items")
      .select("item_id, role, sort_order")
      .eq("visualization_id", result.visualization_id!)
      .order("sort_order");
    expect(items).toHaveLength(2);
    expect(items?.[0]?.role).toBe("top");

    const { count } = await admin
      .from("outfit_visualization_jobs")
      .select("id", { count: "exact", head: true })
      .eq("visualization_id", result.visualization_id!);
    expect(count).toBe(1);
  });

  it("reuses an in-flight visualization for an identical snapshot", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);
    const items = snapshotItems(user.id, top.id, bottom.id);

    const first = await requestVisualization(user, "c".repeat(64), items);
    const second = await requestVisualization(user, "c".repeat(64), items);

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("reused");
    expect(second.visualization_id).toBe(first.visualization_id);

    // The decisive assertion: a duplicate click must not create a second
    // paid job or consume a second quota unit.
    const { count } = await admin
      .from("outfit_visualization_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(count).toBe(1);

    const { data: counter } = await admin
      .from("feature_usage_counters")
      .select("usage_count")
      .eq("user_id", user.id)
      .eq("feature", "outfit_visualization_generation")
      .maybeSingle();
    expect(counter?.usage_count).toBe(1);
  });

  it("takes its daily budget from feature_limits, not from the caller", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);
    const items = snapshotItems(user.id, top.id, bottom.id);

    // Spend the whole server-owned budget by pre-filling the counter, which is
    // the only way to exhaust it: the limit is no longer an RPC argument, so a
    // client cannot raise (or lower) it.
    const { data: limitRow } = await admin
      .from("feature_limits")
      .select("daily_limit")
      .eq("feature", "outfit_visualization_generation")
      .single();
    const { error: seedError } = await admin.from("feature_usage_counters").insert({
      user_id: user.id,
      feature: "outfit_visualization_generation",
      period: "day",
      period_start: new Date().toISOString().slice(0, 10),
      usage_count: limitRow!.daily_limit,
    });
    if (seedError) throw seedError;

    const result = await requestVisualization(user, "d".repeat(64), items);
    expect(result.outcome).toBe("quota_exhausted");
    expect(result.reset_at).toBeTruthy();
  });

  it("reports queue_full distinctly from quota_exhausted", async () => {
    const user = await freshUser();
    const referenceId = await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);
    const items = snapshotItems(user.id, top.id, bottom.id);

    // Fill the per-user in-flight cap (a server constant) directly rather than
    // through the RPC: the per-minute rate limiter would otherwise trip first,
    // and this test is about the queue cap specifically.
    for (const hash of ["a1", "a2", "a3"]) {
      const { data: visualization, error } = await admin
        .from("outfit_visualizations")
        .insert({
          user_id: user.id,
          source_kind: "composition",
          source_hash: hash.repeat(32),
          status: "queued",
          identity_reference_id: referenceId,
          prompt_version: "p",
          provider: "fake",
          model_key: "fake",
          capability_version: "c",
          output_size: "1024x1536",
          output_quality: "high",
          qa_version: "q",
          localization_version: "l",
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: jobError } = await admin
        .from("outfit_visualization_jobs")
        .insert({ visualization_id: visualization.id, user_id: user.id });
      if (jobError) throw jobError;
    }

    const result = await requestVisualization(user, "a4".repeat(32), items);
    expect(result.outcome).toBe("queue_full");
  });

  it("rejects a look with no valid foundation before spending anything", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top } = await seedFoundation(admin, user.id);

    // A single top is not a complete look. Without this check a caller could
    // pay to render themselves wearing one garment.
    const result = await requestVisualization(user, "a5".repeat(32), [
      {
        item_id: top.id,
        role: "top",
        sort_order: 0,
        cutout_bucket_id: "wardrobe-items",
        cutout_storage_path: `${user.id}/${top.id}/cutout.png`,
        cutout_sha256: "b".repeat(64),
      },
    ]);
    expect(result.outcome).toBe("conflict");
    expect(result.reason).toMatch(/one dress, or one top with one bottom/i);
  });

  it("rejects a garment sent under the wrong role", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);
    const items = snapshotItems(user.id, top.id, bottom.id);
    // Relabel the bottom as a dress: the prompt would render it as one.
    const tampered = [items[0], { ...items[1], role: "dress" }];

    const result = await requestVisualization(user, "a6".repeat(32), tampered);
    expect(result.outcome).toBe("conflict");
  });

  it("rejects a snapshot containing an unavailable item", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);
    await admin
      .from("wardrobe_items")
      .update({ availability_status: "laundry" })
      .eq("id", bottom.id);

    const result = await requestVisualization(
      user,
      "9".repeat(64).replace(/9/g, "b"),
      snapshotItems(user.id, top.id, bottom.id),
    );
    expect(result.outcome).toBe("conflict");
  });

  it("refuses to render another user's garment", async () => {
    const owner = await freshUser();
    const attacker = await freshUser();
    await seedIdentityReference(admin, attacker.id, attacker.client);
    const { top, bottom } = await seedFoundation(admin, owner.id);

    const result = await requestVisualization(
      attacker,
      "c".repeat(64),
      snapshotItems(attacker.id, top.id, bottom.id),
    );
    expect(result.outcome).toBe("conflict");
  });

  it("records consent version on the active reference", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { data } = await admin
      .from("profile_identity_references")
      .select("consent_version, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    expect(data?.consent_version).toBe(CONSENT_VERSION);
  });
});
