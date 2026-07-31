import { describe, expect, it } from "vitest";

import { evaluateQaGate, type VisualizationAssessment } from "@/lib/visualization";

const ITEM = "11111111-1111-4111-8111-111111111111";

function garment(overrides: Partial<VisualizationAssessment["garments"][number]> = {}) {
  return {
    itemId: ITEM,
    role: "top" as const,
    present: true,
    colorFidelity: "pass" as const,
    patternFidelity: "pass" as const,
    silhouetteFidelity: "pass" as const,
    constructionFidelity: "pass" as const,
    closureFidelity: "pass" as const,
    distinctiveDetailFidelity: "pass" as const,
    ...overrides,
  };
}

function assessment(overrides: Partial<VisualizationAssessment> = {}): VisualizationAssessment {
  return {
    identity: { recognizableMatch: "pass", faceVisible: true },
    framing: { singlePerson: true, fullBodyVisible: true, headVisible: true, shoesVisible: true },
    anatomy: { verdict: "pass", issues: [] },
    garments: [garment()],
    extraGarments: [],
    verdict: "pass",
    correctionInstructions: [],
    safeSummary: "Looks right.",
    ...overrides,
  };
}

describe("QA gate", () => {
  it("passes a clean assessment", () => {
    expect(evaluateQaGate(assessment()).verdict).toBe("pass");
  });

  it("fails terminally when the identity does not match", () => {
    const result = evaluateQaGate(
      assessment({ identity: { recognizableMatch: "fail", faceVisible: true } }),
    );
    expect(result.verdict).toBe("fail");
    expect(result.reasons[0]).toMatch(/does not match your reference photo/);
  });

  it("fails terminally on more than one person", () => {
    expect(
      evaluateQaGate(
        assessment({
          framing: {
            singlePerson: false,
            fullBodyVisible: true,
            headVisible: true,
            shoesVisible: true,
          },
        }),
      ).verdict,
    ).toBe("fail");
  });

  it("fails terminally on broken anatomy", () => {
    expect(
      evaluateQaGate(assessment({ anatomy: { verdict: "fail", issues: ["three hands"] } })).verdict,
    ).toBe("fail");
  });

  it("treats a missing garment as correctable", () => {
    const result = evaluateQaGate(assessment({ garments: [garment({ present: false })] }));
    expect(result.verdict).toBe("correctable");
    expect(result.reasons[0]).toMatch(/missing/);
  });

  it("treats an unfaithful foundation garment as correctable", () => {
    const result = evaluateQaGate(assessment({ garments: [garment({ colorFidelity: "fail" })] }));
    expect(result.verdict).toBe("correctable");
  });

  it("does not fail on a loosely rendered accessory", () => {
    const result = evaluateQaGate(
      assessment({ garments: [garment({ role: "accessory", colorFidelity: "fail" })] }),
    );
    expect(result.verdict).toBe("pass");
  });

  it("treats an invented garment as correctable", () => {
    const result = evaluateQaGate(assessment({ extraGarments: ["a leather jacket"] }));
    expect(result.verdict).toBe("correctable");
    expect(result.reasons[0]).toMatch(/added a garment/);
  });

  it("treats cropped framing as correctable", () => {
    const result = evaluateQaGate(
      assessment({
        framing: {
          singlePerson: true,
          fullBodyVisible: false,
          headVisible: true,
          shoesVisible: true,
        },
      }),
    );
    expect(result.verdict).toBe("correctable");
  });

  it("carries no body, weight, age, or attractiveness field in the schema", () => {
    const serialized = JSON.stringify(assessment());
    for (const forbidden of ["bodyType", "weight", "age", "ethnicity", "attractiveness", "fit"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
