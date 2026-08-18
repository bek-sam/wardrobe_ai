import { describe, expect, it } from "vitest";

import { extractTripDestination } from "@/lib/ai/agents/orchestrator/intent";

/**
 * The extractor is purely deterministic -- no model call, no geocoder -- so
 * every case here is an exact assertion rather than a fuzzy match. The point
 * of the suite is that a destination is read from what the sentence says, not
 * from whether the user happened to capitalise it.
 */
describe("trip destination extraction", () => {
  it("reads a lowercase destination the same as a capitalised one", () => {
    expect(extractTripDestination("pack me for chicago")).toBe("chicago");
    expect(extractTripDestination("Pack me for Chicago")).toBe("Chicago");
    expect(extractTripDestination("PACK ME FOR CHICAGO")).toBe("CHICAGO");
  });

  it("preserves the casing the user wrote rather than respelling it", () => {
    expect(extractTripDestination("flying to Mexico City on Friday")).toBe("Mexico City");
    expect(extractTripDestination("flying to mexico city on friday")).toBe("mexico city");
  });

  it("strips a leading duration and its preposition", () => {
    expect(extractTripDestination("packing for 3 days in new york")).toBe("new york");
    expect(extractTripDestination("packing for three days in New York")).toBe("New York");
    expect(extractTripDestination("pack for a few days in berlin")).toBe("berlin");
  });

  it("keeps multiword place names and their connectors", () => {
    expect(extractTripDestination("a trip to rio de janeiro next week")).toBe("rio de janeiro");
    expect(extractTripDestination("trip to The Hague")).toBe("The Hague");
    expect(extractTripDestination("travelling to stratford upon avon")).toBe("stratford upon avon");
    expect(extractTripDestination("a trip to las vegas")).toBe("las vegas");
  });

  it("cuts trailing temporal clauses, dates, and punctuation", () => {
    expect(extractTripDestination("a trip to rio de janeiro next week")).toBe("rio de janeiro");
    expect(extractTripDestination("trip to Boston tomorrow")).toBe("Boston");
    expect(extractTripDestination("trip to Boston on 2026-08-01")).toBe("Boston");
    expect(extractTripDestination("trip to Boston, then home")).toBe("Boston");
    expect(extractTripDestination("trip to Boston starting Monday")).toBe("Boston");
    expect(extractTripDestination("flying to Lisbon and Porto")).toBe("Lisbon");
  });

  it("recognises the various travel phrasings", () => {
    expect(extractTripDestination("heading to Oslo")).toBe("Oslo");
    expect(extractTripDestination("visiting Kyoto")).toBe("Kyoto");
    expect(extractTripDestination("visiting the office")).toBeNull();
    expect(extractTripDestination("going to Kyoto")).toBe("Kyoto");
    expect(extractTripDestination("staying in Seville")).toBe("Seville");
    expect(extractTripDestination("pack my suitcase for Dublin")).toBe("Dublin");
  });

  it("treats 'in <place>' as a destination only when the sentence is about travel", () => {
    expect(extractTripDestination("packing for a rainy trip to New York next week")).toBe(
      "New York",
    );
    expect(extractTripDestination("what should I wear in rain")).toBeNull();
    expect(extractTripDestination("what should I wear in the office")).toBeNull();
  });

  it("returns null when no place is named", () => {
    expect(extractTripDestination("pack me for Monday")).toBeNull();
    expect(extractTripDestination("pack me for monday")).toBeNull();
    expect(extractTripDestination("pack for three days")).toBeNull();
    expect(extractTripDestination("pack for 3 days")).toBeNull();
    expect(extractTripDestination("pack for the weekend")).toBeNull();
    expect(extractTripDestination("dress me for work")).toBeNull();
    expect(extractTripDestination("what should I wear tomorrow?")).toBeNull();
  });

  it("blocks non-destinations even inside travel phrasing", () => {
    expect(extractTripDestination("pack me for work")).toBeNull();
    expect(extractTripDestination("trip to home")).toBeNull();
    expect(extractTripDestination("pack me for summer")).toBeNull();
  });

  it("bounds the length of what it will accept as a place", () => {
    const long = extractTripDestination(`trip to ${"a".repeat(200)}`);
    expect(long).not.toBeNull();
    expect((long ?? "").length).toBeLessThanOrEqual(80);

    // Never runs past a sane word count into the rest of the sentence.
    expect(extractTripDestination("trip to one two three four five six seven")).toBe(
      "one two three four",
    );
  });
});
