import { describe, expect, it } from "vitest";

import { normalizeRequestOutcome } from "@/lib/visualization-pipeline";

const visualizationId = "11111111-1111-4111-8111-111111111111";

describe("visualization request outcome contract", () => {
  it("maps database fields to the public API shape", () => {
    expect(
      normalizeRequestOutcome({
        outcome: "created",
        visualization_id: visualizationId,
        status: "queued",
      }),
    ).toEqual({ outcome: "created", visualizationId, status: "queued" });
    expect(
      normalizeRequestOutcome({ outcome: "quota_exhausted", reset_at: "2026-08-01T00:00:00Z" }),
    ).toEqual({ outcome: "quota_exhausted", resetAt: "2026-08-01T00:00:00Z" });
  });

  it("fails closed for an unknown database outcome", () => {
    expect(normalizeRequestOutcome({ outcome: "unexpected" }).outcome).toBe("conflict");
    expect(normalizeRequestOutcome(null).outcome).toBe("conflict");
  });
});
