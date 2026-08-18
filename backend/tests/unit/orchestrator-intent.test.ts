import { beforeEach, describe, expect, it, vi } from "vitest";

const runAiTaskMock = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  runAiTask: (...args: unknown[]) => runAiTaskMock(...args),
}));

const {
  buildItemQuery,
  classifyWardrobeIntent,
  classifyWardrobeIntentDetailed,
  extractTripDestination,
  resolveInsightSlots,
  resolveRequestDateRange,
  resolveWardrobeIntent,
  resolveWardrobeIntentDeterministic,
} = await import("@/lib/ai/agents/orchestrator/intent");

// Friday.
const BASE_DATE = "2026-07-24";
const USER_ID = "00000000-0000-4000-8000-000000000001";

describe("wardrobe intent classification", () => {
  beforeEach(() => {
    runAiTaskMock.mockReset();
    process.env.AI_ORCHESTRATION_URL = "http://ai-orchestration:3002";
    process.env.AI_SERVICE_TOKEN = "t".repeat(32);
  });

  it("routes the requests that used to be forced through outfit composition", () => {
    expect(classifyWardrobeIntent("Do I own a blue blazer?")).toBe("item_question");
    expect(classifyWardrobeIntent("What have I not worn this year?")).toBe("insight");
    expect(classifyWardrobeIntent("Pack me for Chicago")).toBe("packing");
    expect(classifyWardrobeIntent("Plan next week")).toBe("planning");
    expect(classifyWardrobeIntent("How many white shirts do I have?")).toBe("item_question");
    expect(classifyWardrobeIntent("What is my cost per wear?")).toBe("insight");
  });

  it("keeps ordinary styling requests on the outfit route", () => {
    expect(classifyWardrobeIntent("Dress me for work tomorrow")).toBe("outfit_request");
    expect(classifyWardrobeIntent("A casual rainy-day look")).toBe("outfit_request");
    expect(classifyWardrobeIntent("What goes with my favorite layer?")).toBe("outfit_request");
    expect(classifyWardrobeIntent("What should I wear tonight?")).toBe("outfit_request");
  });

  it("reports low confidence for text the rules cannot read", () => {
    const vague = classifyWardrobeIntentDetailed("something nice for later");
    expect(vague.intent).toBe("outfit_request");
    expect(vague.confidence).toBeLessThan(0.6);
    expect(classifyWardrobeIntentDetailed("Plan next week").confidence).toBeGreaterThan(0.6);
  });

  it("treats a single-day planning request as an outfit request", () => {
    const single = resolveWardrobeIntentDeterministic("Plan a dinner outfit", BASE_DATE);
    expect(single.intent).toBe("outfit_request");
    const week = resolveWardrobeIntentDeterministic("Plan my outfits for next week", BASE_DATE);
    expect(week.intent).toBe("planning");
    expect(week.range).toMatchObject({ startDate: "2026-07-27", dayCount: 7 });
  });

  it("never calls the model when the rules are confident", async () => {
    const resolved = await resolveWardrobeIntent({
      request: "Do I own a blue blazer?",
      date: BASE_DATE,
      userId: USER_ID,
    });
    expect(resolved.intent).toBe("item_question");
    expect(resolved.source).toBe("rules");
    expect(runAiTaskMock).not.toHaveBeenCalled();
  });

  it("escalates ambiguous text and keeps deterministic slots", async () => {
    runAiTaskMock.mockResolvedValue({ intent: "insight", confidence: 0.8 });

    const resolved = await resolveWardrobeIntent({
      request: "something nice for later",
      date: BASE_DATE,
      userId: USER_ID,
    });
    expect(resolved.intent).toBe("insight");
    expect(resolved.source).toBe("model");
    expect(resolved.confidence).toBe(0.8);
    expect(runAiTaskMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the deterministic route when escalation fails", async () => {
    runAiTaskMock.mockRejectedValue(new Error("upstream unavailable"));

    const resolved = await resolveWardrobeIntent({
      request: "something nice for later",
      date: BASE_DATE,
      userId: USER_ID,
    });
    expect(resolved.intent).toBe("outfit_request");
    expect(resolved.source).toBe("rules");
  });
});

describe("intent slot extraction", () => {
  it("resolves the calendar window a request names", () => {
    expect(resolveRequestDateRange("plan next week", BASE_DATE)).toMatchObject({
      startDate: "2026-07-27",
      endDate: "2026-08-02",
      dayCount: 7,
    });
    expect(resolveRequestDateRange("what about this weekend", BASE_DATE)).toMatchObject({
      startDate: "2026-07-25",
      dayCount: 2,
    });
    expect(resolveRequestDateRange("dress me for work tomorrow", BASE_DATE)).toMatchObject({
      startDate: "2026-07-25",
      dayCount: 1,
    });
    expect(resolveRequestDateRange("pack for 4 days", BASE_DATE)).toMatchObject({
      startDate: BASE_DATE,
      endDate: "2026-07-27",
      dayCount: 4,
    });
    expect(resolveRequestDateRange("pack for three days", BASE_DATE)?.dayCount).toBe(3);
    expect(resolveRequestDateRange("from 2026-08-03 to 2026-08-05", BASE_DATE)).toMatchObject({
      startDate: "2026-08-03",
      dayCount: 3,
    });
    expect(resolveRequestDateRange("a casual look", BASE_DATE)).toBeNull();
  });

  it("caps any window at the supported planning length", () => {
    expect(resolveRequestDateRange("pack for 12 days", BASE_DATE)?.dayCount).toBe(7);
  });

  it("extracts a trip destination only from travel phrasing", () => {
    expect(extractTripDestination("Pack me for Chicago")).toBe("Chicago");
    expect(extractTripDestination("packing for a rainy trip to New York next week")).toBe(
      "New York",
    );
    expect(extractTripDestination("pack me for Monday")).toBeNull();
    expect(extractTripDestination("what should i wear")).toBeNull();
  });

  it("reads item lookups as required colour and garment filters", () => {
    const query = buildItemQuery("Do I own a blue blazer?");
    expect(query.colors).toEqual(["blue"]);
    expect(query.categories).toEqual(["blazer"]);
    expect(query.terms).toContain("blazer");
    expect(query.terms).not.toContain("own");
    expect(buildItemQuery("show me my favorite clean shoes")).toMatchObject({
      favoritesOnly: true,
      availableOnly: true,
      categories: ["shoe"],
    });
  });

  it("reads the period an insight question measures", () => {
    expect(resolveInsightSlots("what have i not worn this year", BASE_DATE)).toEqual({
      focus: "unworn",
      unwornSince: "2026-01-01",
    });
    expect(resolveInsightSlots("anything i haven't worn in 6 months", BASE_DATE)).toEqual({
      focus: "unworn",
      unwornSince: "2026-01-24",
    });
    expect(resolveInsightSlots("what is my cost per wear", BASE_DATE).focus).toBe("cost_per_wear");
    expect(resolveInsightSlots("where are my wardrobe gaps", BASE_DATE).focus).toBe("gaps");
    expect(resolveInsightSlots("show me my wardrobe stats", BASE_DATE).focus).toBe("overview");
  });
});
