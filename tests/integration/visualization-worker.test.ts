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

async function seedQueued(hash: string) {
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
  const { data: job } = await admin
    .from("outfit_visualization_jobs")
    .select("id")
    .eq("visualization_id", visualizationId)
    .single();
  return { user, visualizationId, jobId: job!.id as string, top };
}

async function claimOwn(visualizationId: string) {
  const { data } = await admin.rpc("claim_outfit_visualization_jobs", {
    p_limit: 20,
    p_lease_seconds: 600,
    p_locked_by: "test",
  });
  return (data as { id: string; visualization_id: string }[]).find(
    (job) => job.visualization_id === visualizationId,
  );
}

describe("visualization worker lifecycle", () => {
  it("advances through the named progress stages", async () => {
    const { user, visualizationId } = await seedQueued("c1".repeat(32));
    await claimOwn(visualizationId);

    for (const status of ["validating_inputs", "generating", "qa_review", "localizing"]) {
      await admin.rpc("advance_outfit_visualization", {
        p_visualization_id: visualizationId,
        p_user_id: user.id,
        p_status: status,
      });
      const { data } = await admin
        .from("outfit_visualizations")
        .select("status")
        .eq("id", visualizationId)
        .single();
      expect(data?.status).toBe(status);
    }
  });

  it("rejects an unknown stage rather than writing it", async () => {
    const { user, visualizationId } = await seedQueued("c2".repeat(32));
    const { error } = await admin.rpc("advance_outfit_visualization", {
      p_visualization_id: visualizationId,
      p_user_id: user.id,
      p_status: "ready",
    });
    expect(error).toBeTruthy();
  });

  it("refuses to finalize a job that is not leased", async () => {
    const { user, visualizationId, jobId } = await seedQueued("c3".repeat(32));
    const { error } = await admin.rpc("finalize_outfit_visualization", {
      p_job_id: jobId,
      p_user_id: user.id,
      p_bucket: "wardrobe-generated",
      p_storage_path: `${user.id}/visualizations/${visualizationId}/a.png`,
      p_output_sha256: "e".repeat(64),
      p_qa_summary: {},
      p_hotspots: [],
      p_request_id: null,
    });
    expect(error?.message).toMatch(/not_leased/);
  });

  it("stores hotspots onto the snapshot rows on finalize", async () => {
    const { user, visualizationId, top } = await seedQueued("c4".repeat(32));
    const job = await claimOwn(visualizationId);
    await admin.rpc("finalize_outfit_visualization", {
      p_job_id: job!.id,
      p_user_id: user.id,
      p_bucket: "wardrobe-generated",
      p_storage_path: `${user.id}/visualizations/${visualizationId}/a.png`,
      p_output_sha256: "f".repeat(64),
      p_qa_summary: { verdict: "pass" },
      p_hotspots: [
        {
          version: 1,
          itemId: top.id,
          role: "top",
          shape: "rect",
          bounds: { x: 0.3, y: 0.2, width: 0.4, height: 0.25 },
          confidence: 0.9,
          source: "model",
          zIndex: 4,
        },
      ],
      p_request_id: null,
    });

    const { data } = await admin
      .from("outfit_visualization_items")
      .select("item_id, hotspot")
      .eq("visualization_id", visualizationId)
      .eq("item_id", top.id)
      .single();
    expect(data?.hotspot).toMatchObject({ itemId: top.id, source: "model" });
  });

  it("re-queues a retryable failure and marks a terminal one failed_terminal", async () => {
    const retryable = await seedQueued("c5".repeat(32));
    const job = await claimOwn(retryable.visualizationId);
    await admin.rpc("fail_outfit_visualization", {
      p_job_id: job!.id,
      p_user_id: retryable.user.id,
      p_error_code: "provider_transient",
      p_error_summary: "temporarily unavailable",
      p_retryable: true,
      p_next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      p_qa_summary: null,
      p_request_id: null,
    });
    const { data: retryRow } = await admin
      .from("outfit_visualizations")
      .select("status")
      .eq("id", retryable.visualizationId)
      .single();
    expect(retryRow?.status).toBe("failed_retryable");

    const terminal = await seedQueued("c6".repeat(32));
    const terminalJob = await claimOwn(terminal.visualizationId);
    await admin.rpc("fail_outfit_visualization", {
      p_job_id: terminalJob!.id,
      p_user_id: terminal.user.id,
      p_error_code: "qa_rejected",
      p_error_summary: "did not pass the fidelity check",
      p_retryable: false,
      p_next_attempt_at: null,
      p_qa_summary: { verdict: "fail" },
      p_request_id: null,
    });
    const { data: terminalRow } = await admin
      .from("outfit_visualizations")
      .select("status, qa_status")
      .eq("id", terminal.visualizationId)
      .single();
    expect(terminalRow?.status).toBe("failed_terminal");
    expect(terminalRow?.qa_status).toBe("fail");
  });

  it("blocks rather than fails a moderation rejection", async () => {
    const { user, visualizationId } = await seedQueued("c7".repeat(32));
    const job = await claimOwn(visualizationId);
    await admin.rpc("fail_outfit_visualization", {
      p_job_id: job!.id,
      p_user_id: user.id,
      p_error_code: "moderation_blocked",
      p_error_summary: "blocked",
      p_retryable: false,
      p_next_attempt_at: null,
      p_qa_summary: null,
      p_request_id: null,
    });
    const { data } = await admin
      .from("outfit_visualizations")
      .select("status")
      .eq("id", visualizationId)
      .single();
    expect(data?.status).toBe("blocked");
  });

  it("caps corrective regenerations at one", async () => {
    const { user, visualizationId } = await seedQueued("c8".repeat(32));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await admin.rpc("record_visualization_correction", {
        p_visualization_id: visualizationId,
        p_user_id: user.id,
      });
    }
    const { data } = await admin
      .from("outfit_visualizations")
      .select("corrective_attempt_count")
      .eq("id", visualizationId)
      .single();
    expect(data?.corrective_attempt_count).toBe(1);
  });
});

describe("account lifecycle", () => {
  it("cascades every new table when the account is deleted", async () => {
    const { user, visualizationId } = await seedQueued("d1".repeat(32));
    await deleteTestUser(admin, user.id);

    for (const [table, column] of [
      ["outfit_visualizations", "id"],
      ["outfit_visualization_items", "visualization_id"],
      ["outfit_visualization_jobs", "visualization_id"],
      ["profile_identity_references", "user_id"],
    ] as const) {
      const value = column === "user_id" ? user.id : visualizationId;
      const { data } = await admin.from(table).select("*").eq(column, value);
      expect(data ?? []).toHaveLength(0);
    }
  });
});
