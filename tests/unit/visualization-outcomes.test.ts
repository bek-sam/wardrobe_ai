import { describe, expect, it } from "vitest";

import { normalizeRequestOutcome } from "@/lib/visualization-pipeline";
import { outcomeNotice } from "@/features/studio/hooks/outcome-notice";
import type { VisualizationOutcome } from "@/features/studio/api/tryon-client";

const VISUALIZATION_ID = "11111111-1111-4111-8111-111111111111";

/**
 * The RPC speaks snake_case and the client contract speaks camelCase. Getting
 * this wrong is silent: the request succeeds, and the browser simply never
 * learns which visualization to poll.
 */
describe("normalizeRequestOutcome", () => {
  it("maps a created outcome's snake_case id to camelCase", () => {
    expect(
      normalizeRequestOutcome({
        outcome: "created",
        visualization_id: VISUALIZATION_ID,
        status: "queued",
      }),
    ).toEqual({ outcome: "created", visualizationId: VISUALIZATION_ID, status: "queued" });
  });

  it("preserves the live status on a reuse", () => {
    expect(
      normalizeRequestOutcome({
        outcome: "reused",
        visualization_id: VISUALIZATION_ID,
        status: "generating",
      }),
    ).toEqual({ outcome: "reused", visualizationId: VISUALIZATION_ID, status: "generating" });
  });

  it("carries the reset time through on an exhausted quota", () => {
    expect(
      normalizeRequestOutcome({ outcome: "quota_exhausted", reset_at: "2026-08-01T00:00:00Z" }),
    ).toEqual({ outcome: "quota_exhausted", resetAt: "2026-08-01T00:00:00Z" });
  });

  it("keeps queue_full distinct from quota_exhausted", () => {
    expect(normalizeRequestOutcome({ outcome: "queue_full", reset_at: null })).toEqual({
      outcome: "queue_full",
      resetAt: null,
    });
  });

  it("passes the conflict reason through", () => {
    expect(normalizeRequestOutcome({ outcome: "conflict", reason: "no longer available" })).toEqual(
      { outcome: "conflict", reason: "no longer available" },
    );
  });

  it("falls back to a conflict rather than inventing a success", () => {
    expect(normalizeRequestOutcome({ outcome: "something_unexpected" }).outcome).toBe("conflict");
    expect(normalizeRequestOutcome(null).outcome).toBe("conflict");
  });
});

describe("outcomeNotice", () => {
  function notice(outcome: VisualizationOutcome["outcome"], extra = {}) {
    return outcomeNotice({ outcome, pollAfterMs: 1_500, ...extra } as VisualizationOutcome);
  }

  it("says nothing extra when an image is genuinely already ready", () => {
    expect(notice("already_fresh")).toBeNull();
  });

  // The bug this replaces told users an image existed when none had been made,
  // so each of these must say something the "already fresh" case never says.
  it("never tells a user their image is ready when the queue is full", () => {
    const message = notice("queue_full");
    expect(message).toMatch(/maximum number of try-ons in progress/i);
    expect(message).not.toBe(notice("already_fresh"));
    expect(message).not.toMatch(/\bis ready\b/i);
  });

  it("never tells a user their image is ready when the quota is gone", () => {
    const message = notice("quota_exhausted");
    expect(message).toMatch(/used today's try-ons/i);
    expect(message).not.toBe(notice("already_fresh"));
    expect(message).not.toMatch(/\bis ready\b/i);
  });

  it("gives each outcome its own distinct message", () => {
    const messages = (
      [
        "created",
        "reused",
        "queue_full",
        "quota_exhausted",
        "needs_identity",
        "needs_consent",
      ] as const
    ).map((outcome) => notice(outcome));
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("names the reset time when the backend supplied one", () => {
    expect(notice("quota_exhausted", { resetAt: "2026-08-01T09:00:00Z" })).toMatch(/reset at/i);
  });

  it("flags the setup outcomes so the gate can be shown", () => {
    expect(notice("needs_identity")).toMatch(/reference photo/i);
    expect(notice("needs_consent")).toMatch(/consent/i);
  });
});
