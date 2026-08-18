import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import {
  adminClient,
  createDisposableUser,
  deleteDisposableUser,
  e2eSupabaseConfig,
  seedWardrobe,
  type SeededUser,
} from "./seed";
import { seedCutout, seedIdentityReference } from "./studio-seed";
import { stubVariants } from "./studio-variants-fixture";

/**
 * The Outfit Studio flow end to end against the deterministic fake image
 * provider: three-variant results, the real cut-out flat lay, an actual
 * try-on generation through the durable job, garment hotspots, DB-backed
 * details, and the route to the exact wardrobe item. No OpenAI key, no paid
 * call — only the stylist-model endpoint is stubbed.
 */
const supabaseReady = e2eSupabaseConfig() !== null;

test.describe("outfit studio", () => {
  test.skip(
    !supabaseReady,
    "Local Supabase is not configured. Run `npx supabase start --workdir database` and re-run.",
  );

  // Image generation, QA, and localization all run for real (against the fake
  // provider) inside one request; give it room past the default.
  test.setTimeout(120_000);

  let admin: SupabaseClient;
  let user: SeededUser;
  let items: { blazerId: string; topId: string; bottomId: string };

  test.beforeAll(async () => {
    admin = adminClient();
    user = await createDisposableUser(admin);
    items = await seedWardrobe(admin, user.id);
    await Promise.all([
      seedCutout(admin, user.id, items.topId),
      seedCutout(admin, user.id, items.bottomId),
      seedCutout(admin, user.id, items.blazerId),
    ]);
    await seedIdentityReference(admin, user.id);
  });

  test.afterAll(async () => {
    if (user) await deleteDisposableUser(admin, user.id);
  });

  async function openStudio(page: Page) {
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /log in securely/i }).click();
    await page.waitForURL(/\/today/, { timeout: 30_000 });

    await stubVariants(page, items);
    // Navigate the way a user does. A `goto` here races the client-side
    // navigation the app is still finishing after sign-in, and Playwright
    // aborts the one that started second; clicking the link cannot race it.
    await page
      .getByRole("link", { name: /^studio$/i })
      .filter({ visible: true })
      .first()
      .click();
    await page.waitForURL(/\/studio/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /what are you dressing for/i })).toBeVisible();
  }

  async function requestLooks(page: Page) {
    await page.getByLabel(/where are you going/i).fill("Dinner after work");
    await page.getByRole("button", { name: /show me three looks/i }).click();
    await expect(page.getByRole("tab", { name: /safe/i })).toBeVisible();
  }

  test("shows variants, a real cut-out flat lay, and an interactive try-on", async ({ page }) => {
    await openStudio(page);
    await requestLooks(page);

    // Variants are genuinely distinct and switchable.
    await expect(page.getByRole("tab", { name: /safe/i })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /fresh/i }).click();
    await expect(page.getByText(/blazer over the corduroys/i)).toBeVisible();

    // Flat lay renders the user's real cut-outs, with no image generation.
    // The waiter is registered *before* the click that triggers the fetch, so
    // this synchronizes on the response instead of racing it — and a failing
    // call reports itself rather than surfacing as a bare "0 images".
    const cutoutResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/items/cutouts") && response.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("tab", { name: /safe/i }).click();
    const cutouts = await (await cutoutResponse).json();
    expect(cutouts.data.cutouts.length).toBeGreaterThanOrEqual(2);

    const flatLay = page.getByTestId("flat-lay");
    await expect(flatLay).toBeVisible();
    await expect(flatLay.locator("img")).toHaveCount(2);

    // Try-on: explicit user action, then the real durable pipeline.
    await page
      .getByRole("button", { name: /^try it on$/i })
      .first()
      .click();
    await expect(page.getByAltText(/ai style visualization/i)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/style visualization, not size or fit prediction/i)).toBeVisible();

    // Garment chips are the accessible route to every piece.
    const chip = page.getByRole("button", { name: /navy shirt/i }).first();
    await chip.click();
    await expect(page.getByRole("dialog", { name: /details for navy shirt/i })).toBeVisible();

    // Details are database-backed and route to the exact owned item.
    const viewClothing = page.getByRole("link", { name: /view clothing/i });
    await expect(viewClothing).toHaveAttribute("href", `/wardrobe/${items.topId}`);
  });

  test("selects every garment with the keyboard alone", async ({ page }) => {
    await openStudio(page);
    await requestLooks(page);

    const chips = page.locator(".garment-chip");
    await expect(chips).toHaveCount(2);
    await chips.first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();

    // Escape closes the sheet and returns focus to the control that opened it.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(chips.first()).toBeFocused();
  });

  test("locks a piece and keeps it through a remix", async ({ page }) => {
    await openStudio(page);
    await requestLooks(page);

    await page.getByRole("button", { name: /^lock navy shirt$/i }).click();
    await expect(page.getByRole("button", { name: /^unlock navy shirt$/i })).toBeVisible();
    await expect(page.getByText(/1 piece locked/i)).toBeVisible();

    // Remix re-requests with the locked id attached; the lock survives.
    const request = page.waitForRequest(
      (candidate) =>
        candidate.url().includes("/api/outfits/variants") && candidate.method() === "POST",
    );
    await page.getByRole("button", { name: /remix the rest/i }).click();
    const body = JSON.parse((await request).postData() ?? "{}");
    expect(body.lockedItemIds).toEqual([items.topId]);
  });

  test("saves the look and marks it worn through the canonical routes", async ({ page }) => {
    await openStudio(page);
    await requestLooks(page);

    await page.getByRole("button", { name: /^save look$/i }).click();
    await expect(page.getByText(/saved to your outfits/i)).toBeVisible();

    await page.getByRole("button", { name: /^wear today$/i }).click();
    await expect(page.getByText(/logged as worn today/i)).toBeVisible();

    const { count } = await admin
      .from("wear_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(count).toBeGreaterThan(0);
  });
});
