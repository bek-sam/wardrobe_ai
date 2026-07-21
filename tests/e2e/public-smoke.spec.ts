import { expect, test } from "@playwright/test";

test("landing page links to account creation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Dress for the life you actually live.",
  );
  await expect(page.getByRole("link", { name: /create|start/i }).first()).toBeVisible();
});

test("authentication pages work without configured secrets", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /open your wardrobe/i })).toBeVisible();
  await expect(page.getByLabel(/email address/i)).toBeVisible();
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: /start with what you own/i })).toBeVisible();
});
