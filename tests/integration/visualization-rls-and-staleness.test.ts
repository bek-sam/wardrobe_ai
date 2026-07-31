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

/** A user with an active reference, a foundation, and one queued visualization. */
async function seedVisualization(hash: string) {
  const user = await freshUser();
  await seedIdentityReference(admin, user.id, user.client);
  const { top, bottom } = await seedFoundation(admin, user.id);
  const { data, error } = await user.client.rpc("request_outfit_visualization", {
    p_source_kind: "composition",
    p_source_id: null,
    p_source_hash: hash,
    p_items: snapshotItems(user.id, top.id, bottom.id),
    ...GENERATION_CONFIG,
  });
  if (error) throw error;
  const visualizationId = (data as { visualization_id: string }).visualization_id;
  return { user, top, bottom, visualizationId };
}

/** Claims and finalizes as the service-role worker would, reaching 'ready'. */
async function finalize(visualizationId: string, userId: string) {
  const { data: claimed, error: claimError } = await admin.rpc("claim_outfit_visualization_jobs", {
    p_limit: 5,
    p_lease_seconds: 600,
    p_locked_by: "test",
  });
  if (claimError) throw claimError;
  const job = (claimed as { id: string; visualization_id: string }[]).find(
    (entry) => entry.visualization_id === visualizationId,
  );
  if (!job) throw new Error("job was not claimable");

  const { error } = await admin.rpc("finalize_outfit_visualization", {
    p_job_id: job.id,
    p_user_id: userId,
    p_bucket: "wardrobe-generated",
    p_storage_path: `${userId}/visualizations/${visualizationId}/a.png`,
    p_output_sha256: "d".repeat(64),
    p_qa_summary: { verdict: "pass" },
    p_hotspots: [],
    p_request_id: "req_test",
  });
  if (error) throw error;
}

describe("visualization RLS", () => {
  it("hides another user's visualization, snapshot, job, and feedback", async () => {
    const { user, visualizationId } = await seedVisualization("a1".repeat(32));
    const attacker = await freshUser();

    for (const table of [
      "outfit_visualizations",
      "outfit_visualization_items",
      "outfit_visualization_jobs",
    ]) {
      const column = table === "outfit_visualizations" ? "id" : "visualization_id";
      const { data } = await attacker.client.from(table).select("*").eq(column, visualizationId);
      expect(data ?? []).toHaveLength(0);
    }

    // The owner still sees their own rows, so this is a scoping test rather
    // than an "everything is empty" false pass.
    const { data: owned } = await user.client
      .from("outfit_visualizations")
      .select("id")
      .eq("id", visualizationId);
    expect(owned).toHaveLength(1);
  });

  it("hides another user's identity reference", async () => {
    const { user } = await seedVisualization("a2".repeat(32));
    const attacker = await freshUser();
    const { data } = await attacker.client
      .from("profile_identity_references")
      .select("id")
      .eq("user_id", user.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("refuses feedback on another user's visualization", async () => {
    const { visualizationId } = await seedVisualization("a3".repeat(32));
    const attacker = await freshUser();
    const { error } = await attacker.client.rpc("record_visualization_feedback", {
      p_visualization_id: visualizationId,
      p_reason: "wrong_garment",
      p_comment: null,
    });
    expect(error?.code).toBe("PT404");
  });

  it("denies a direct client write to the visualization state machine", async () => {
    const { user, visualizationId } = await seedVisualization("a4".repeat(32));
    const { error } = await user.client
      .from("outfit_visualizations")
      .update({ status: "ready" })
      .eq("id", visualizationId);
    expect(error).toBeTruthy();
  });
});

describe("staleness", () => {
  it("marks a ready visualization stale when a member item changes", async () => {
    const { user, bottom, visualizationId } = await seedVisualization("b1".repeat(32));
    await finalize(visualizationId, user.id);

    const { data: before } = await admin
      .from("outfit_visualizations")
      .select("status")
      .eq("id", visualizationId)
      .single();
    expect(before?.status).toBe("ready");

    await admin
      .from("wardrobe_items")
      .update({ availability_status: "laundry" })
      .eq("id", bottom.id);

    const { data: after } = await admin
      .from("outfit_visualizations")
      .select("status, stale_reason")
      .eq("id", visualizationId)
      .single();
    expect(after?.status).toBe("stale");
    expect(after?.stale_reason).toBe("wardrobe_item_changed");
  });

  it("marks visualizations stale and queues the old photo when the reference is replaced", async () => {
    const { user, visualizationId } = await seedVisualization("b2".repeat(32));
    await finalize(visualizationId, user.id);
    await seedIdentityReference(admin, user.id, user.client);

    const { data } = await admin
      .from("outfit_visualizations")
      .select("status, stale_reason")
      .eq("id", visualizationId)
      .single();
    expect(data?.status).toBe("stale");
    expect(data?.stale_reason).toBe("identity_reference_replaced");

    const { data: queued } = await admin
      .from("storage_deletion_queue")
      .select("reason")
      .eq("user_id", user.id)
      .eq("reason", "identity_reference_replaced");
    expect((queued ?? []).length).toBeGreaterThan(0);
  });

  it("keeps exactly one active reference after a replacement", async () => {
    const { user } = await seedVisualization("b3".repeat(32));
    await seedIdentityReference(admin, user.id, user.client);
    const { data } = await admin
      .from("profile_identity_references")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null);
    expect(data).toHaveLength(1);
  });

  it("blocks generations and queues assets when consent is revoked", async () => {
    const { user, visualizationId } = await seedVisualization("b4".repeat(32));
    await finalize(visualizationId, user.id);

    const { error } = await user.client.rpc("revoke_identity_reference", { p_delete_assets: true });
    expect(error).toBeFalsy();

    const { data } = await admin
      .from("outfit_visualizations")
      .select("status, error_code")
      .eq("id", visualizationId)
      .single();
    expect(data?.status).toBe("blocked");
    expect(data?.error_code).toBe("consent_revoked");

    const { data: queued } = await admin
      .from("storage_deletion_queue")
      .select("reason")
      .eq("user_id", user.id)
      .eq("reason", "consent_revoked");
    expect((queued ?? []).length).toBeGreaterThan(0);
  });
});
