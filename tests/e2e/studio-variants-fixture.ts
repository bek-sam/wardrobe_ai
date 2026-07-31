import type { Page } from "@playwright/test";

type Items = { topId: string; bottomId: string; blazerId: string };

function item(itemId: string, role: string, name: string, sortOrder: number) {
  return {
    itemId,
    role,
    sortOrder,
    name,
    category: role === "bottom" ? "bottoms" : "tops",
    colorNames: ["navy"],
    primaryColorHex: "#1b2a4a",
    pattern: null,
    availabilityStatus: "available",
    favorite: false,
    wearCount: 1,
  };
}

/**
 * Stubs only the one endpoint that genuinely needs a stylist model. Everything
 * downstream — the flat lay, the try-on request, the worker, QA, localization,
 * hotspots, and every mutation — runs against the real application and the
 * real database, with the deterministic fake image provider.
 */
export async function stubVariants(page: Page, items: Items) {
  await page.route("**/api/outfits/variants", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          kind: "variants",
          generationId: null,
          contextSummary: "Mild and dry in Berlin, so one light layer is plenty.",
          shortfallReason: null,
          weather: null,
          variants: [
            {
              mode: "safe",
              candidateId: "11111111-1111-4111-8111-111111111111",
              title: "Navy shirt with corduroy trousers",
              items: [
                item(items.topId, "top", "Navy shirt", 0),
                item(items.bottomId, "bottom", "Green corduroy trousers", 1),
              ],
              reasons: ["Warm enough for 14 to 23 degrees.", "Quiet, tonal, easy to wear."],
              warnings: [],
              stylistNote: "The dependable version of today.",
              confidence: 0.86,
              styleTags: ["minimal"],
              canVisualize: true,
            },
            {
              mode: "fresh",
              candidateId: "22222222-2222-4222-8222-222222222222",
              title: "Blazer over the corduroys",
              items: [
                item(items.topId, "top", "Navy shirt", 0),
                item(items.bottomId, "bottom", "Green corduroy trousers", 1),
                item(items.blazerId, "layer", "Blue blazer", 2),
              ],
              reasons: ["Brings in a layer you have not worn recently."],
              warnings: [],
              stylistNote: "One extra piece changes the whole register.",
              confidence: 0.78,
              styleTags: ["office-ready"],
              canVisualize: true,
            },
          ],
        },
      }),
    });
  });
}
