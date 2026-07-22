import { describe, expect, it } from "vitest";

import { resolveOccasionContext } from "@/lib/recommendation/occasion-context";

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
});
