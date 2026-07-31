import { afterAll, describe, expect, it } from "vitest";

import { createAdminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";
import {
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

type RequestResult = { outcome: string; visualization_id?: string; status?: string };

function request(user: TestUser, hash: string, items: unknown) {
  return user.client.rpc("request_outfit_visualization", {
    p_source_kind: "composition",
    p_source_id: null,
    p_source_hash: hash,
    p_items: items,
    ...GENERATION_CONFIG,
  });
}

describe("concurrent identical try-on requests", () => {
  /**
   * The reuse check cannot lock a row that does not exist yet, so two truly
   * simultaneous requests both reach the insert. Exactly one paid job may
   * exist afterwards, exactly one quota unit may be spent, and neither caller
   * may see an error.
   */
  it("creates at most one paid job and charges exactly once", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);
    const items = snapshotItems(user.id, top.id, bottom.id);
    const hash = "e1".repeat(32);

    // Three, not more: the per-minute rate limit is a server constant of 3 and
    // is charged before the insert, so a fourth would be rejected by the
    // limiter rather than exercising the race this test exists for.
    const responses = await Promise.all([
      request(user, hash, items),
      request(user, hash, items),
      request(user, hash, items),
    ]);

    for (const response of responses) {
      expect(response.error).toBeNull();
    }

    const outcomes = responses.map((response) => (response.data as RequestResult).outcome);
    expect(outcomes.filter((outcome) => outcome === "created")).toHaveLength(1);
    expect(
      outcomes.every((outcome) => ["created", "reused", "already_fresh"].includes(outcome)),
    ).toBe(true);

    // Every caller must be pointed at the same visualization.
    const ids = new Set(
      responses.map((response) => (response.data as RequestResult).visualization_id),
    );
    expect(ids.size).toBe(1);

    const { count: visualizationCount } = await admin
      .from("outfit_visualizations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(visualizationCount).toBe(1);

    const { count: jobCount } = await admin
      .from("outfit_visualization_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(jobCount).toBe(1);

    // The losers refund the unit they consumed before losing the race.
    const { data: counter } = await admin
      .from("feature_usage_counters")
      .select("usage_count")
      .eq("user_id", user.id)
      .eq("feature", "outfit_visualization_generation")
      .maybeSingle();
    expect(counter?.usage_count).toBe(1);
  });

  it("still creates separate visualizations for genuinely different snapshots", async () => {
    const user = await freshUser();
    await seedIdentityReference(admin, user.id, user.client);
    const { top, bottom } = await seedFoundation(admin, user.id);
    const items = snapshotItems(user.id, top.id, bottom.id);

    const responses = await Promise.all([
      request(user, "e2".repeat(32), items),
      request(user, "e3".repeat(32), items),
    ]);

    const ids = new Set(
      responses.map((response) => (response.data as RequestResult).visualization_id),
    );
    expect(ids.size).toBe(2);

    const { count } = await admin
      .from("outfit_visualization_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(count).toBe(2);
  });
});
