import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateTotp } from "../support/totp";
import {
  adminClient,
  createDisposableUser,
  deleteDisposableUser,
  e2eSupabaseConfig,
  type SeededUser,
} from "./seed";

/**
 * TOTP enrollment through the real Settings UI, then the challenge on the next
 * sign-in. The codes are generated from the secret the enrollment screen
 * displays, which is exactly what an authenticator app does.
 */
const supabaseReady = e2eSupabaseConfig() !== null;

test.describe("two-factor authentication", () => {
  test.skip(!supabaseReady, "Local Supabase is not configured.");
  test.setTimeout(120_000);

  let admin: SupabaseClient;
  let user: SeededUser;

  test.beforeAll(async () => {
    admin = adminClient();
    user = await createDisposableUser(admin);
  });

  test.afterAll(async () => {
    await deleteDisposableUser(admin, user.id).catch(() => undefined);
  });

  test("enrolls a factor, then requires it on the next sign-in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: /log in securely/i }).click();
    await page.goto("/settings");

    const security = page.locator("#settings-security");
    // The recovery warning must be visible before anyone commits to this.
    await expect(security.getByText(/no recovery codes/i)).toBeVisible();
    await security.getByRole("button", { name: /set up an authenticator app/i }).click();

    // The setup key is shown once, in the page, for a user who cannot scan.
    const secret = (await security.locator(".mfa-enrollment__secret").innerText()).trim();
    expect(secret.length).toBeGreaterThan(0);

    await security.getByLabel(/code from your app/i).fill(generateTotp(secret));
    await security.getByRole("button", { name: /verify and turn on/i }).click();
    await expect(security.getByRole("button", { name: /^remove$/i })).toBeVisible();

    // A fresh sign-in now stops at the challenge, whatever page was requested.
    await page.getByRole("button", { name: /sign out this device/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/login?returnTo=%2Fwardrobe");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: /log in securely/i }).click();

    await expect(page).toHaveURL(/\/mfa\/verify/);
    await expect(
      page.getByRole("heading", { name: /enter your authenticator code/i }),
    ).toBeVisible();

    // A wrong code is refused and clears the field rather than resubmitting it.
    await page.getByLabel(/six-digit code/i).fill("000000");
    await page.getByRole("button", { name: /verify and continue/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel(/six-digit code/i)).toHaveValue("");

    await page.getByLabel(/six-digit code/i).fill(generateTotp(secret));
    await page.getByRole("button", { name: /verify and continue/i }).click();
    await expect(page).toHaveURL(/\/wardrobe/);
  });

  test("offers a way out of the challenge for a lost authenticator", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: /log in securely/i }).click();

    await expect(page).toHaveURL(/\/mfa\/verify/);
    await expect(page.getByText(/lost your authenticator/i)).toBeVisible();
    await page.getByRole("button", { name: /cancel and sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
