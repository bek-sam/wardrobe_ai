import { describe, expect, it } from "vitest";

import {
  confidentOccasionTags,
  resolveOccasionContext,
} from "@/lib/recommendation/occasion-context";

describe("resolveOccasionContext", () => {
  it("resolves a job interview to the interview category, not work", () => {
    const result = resolveOccasionContext("I have a job interview downtown");
    expect(result.category).toBe("interview");
    expect(result.targetFormality).toBe(4);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("resolves a business dinner to business rather than dinner", () => {
    expect(resolveOccasionContext("business dinner with clients").category).toBe("business");
  });

  it("resolves plain dinner to the dinner category", () => {
    expect(resolveOccasionContext("dinner with friends").category).toBe("dinner");
  });

  it("resolves a wedding mention", () => {
    expect(resolveOccasionContext("attending my cousin's wedding").category).toBe("wedding");
  });

  it("resolves gym/workout text to exercise", () => {
    expect(resolveOccasionContext("heading to the gym").category).toBe("exercise");
  });

  it("resolves packing/travel text to travel", () => {
    expect(resolveOccasionContext("packing for a trip to Chicago").category).toBe("travel");
  });

  it("falls back to casual with zero confidence for empty input", () => {
    const result = resolveOccasionContext(null);
    expect(result.category).toBe("casual");
    expect(result.confidence).toBe(0);
  });

  it("falls back to casual with low confidence for unmatched text", () => {
    const result = resolveOccasionContext("xyz something unrelated");
    expect(result.category).toBe("casual");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("resolves explicit casual mentions with higher confidence than the default fallback", () => {
    const result = resolveOccasionContext("casual weekend hangout");
    expect(result.category).toBe("casual");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("detects time of day independently of the occasion category", () => {
    expect(resolveOccasionContext("dinner with friends tonight").timeOfDay).toBe("evening");
    expect(resolveOccasionContext("brunch with the team").timeOfDay).toBe("morning");
    expect(resolveOccasionContext("client meeting").timeOfDay).toBe("unspecified");
  });

  it("captures explicit dress-code phrasing verbatim", () => {
    const result = resolveOccasionContext("black tie gala this weekend");
    expect(result.dressCodeConstraints).toContain("black tie");
  });

  it("returns no dress-code constraints when none are mentioned", () => {
    expect(resolveOccasionContext("dinner with friends").dressCodeConstraints).toEqual([]);
  });

  it("flags an unresolved question for low-confidence text", () => {
    const result = resolveOccasionContext("xyz something unrelated");
    expect(result.unresolvedQuestions.length).toBeGreaterThan(0);
  });

  it("asks about dress code for a formal category with none specified", () => {
    const result = resolveOccasionContext("attending my cousin's wedding");
    expect(result.unresolvedQuestions).toContain("Is there a specific dress code to follow?");
  });

  it("has no unresolved questions for a confident, dress-code-specified match", () => {
    const result = resolveOccasionContext("black tie gala this weekend");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.unresolvedQuestions).toEqual([]);
  });
});

describe("confidentOccasionTags", () => {
  it("returns the category's tags for a confident match", () => {
    const context = resolveOccasionContext("business dinner with clients");
    expect(confidentOccasionTags(context)).toEqual(["business", "work"]);
  });

  it("returns undefined for low-confidence unmatched text", () => {
    const context = resolveOccasionContext("xyz something unrelated");
    expect(confidentOccasionTags(context)).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(confidentOccasionTags(resolveOccasionContext(null))).toBeUndefined();
  });

  it("is inclusive at exactly the confidence threshold", () => {
    expect(confidentOccasionTags({ category: "casual", confidence: 0.5 })).toEqual(["casual"]);
    expect(confidentOccasionTags({ category: "casual", confidence: 0.49 })).toBeUndefined();
  });
});
