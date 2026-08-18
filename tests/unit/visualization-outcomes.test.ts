import { describe, expect, it } from "vitest";

import { outcomeNotice } from "@/features/studio/hooks";
import type { VisualizationOutcome } from "@/features/studio/api";

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
