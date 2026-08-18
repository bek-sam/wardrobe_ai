import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";

import { adminClient, createDisposableUser, deleteDisposableUser, e2eSupabaseConfig } from "./seed";
import { clearMailbox, extractAuthLink, waitForEmail } from "./mailpit";

/**
 * The authentication flows, driven through the real UI against local Supabase
 * and Mailpit. Nothing here calls a model, and no third-party service is
 * involved: Google and CAPTCHA are switched off for this run, which is itself
 * asserted below.
 */
const supabaseReady = e2eSupabaseConfig() !== null;

/** Comfortably over the 15-character minimum, and never trimmed. */
const STRONG_PASSWORD = "correct horse battery staple";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in securely/i }).click();
}

test.describe("authentication", () => {
  test.skip(
    !supabaseReady,
    "Local Supabase is not configured. Run `npx supabase start --workdir database` and re-run, or set " +
      "TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY.",
  );
  test.setTimeout(120_000);

  let admin: SupabaseClient;
  const createdUserIds: string[] = [];

  test.beforeAll(async () => {
    admin = adminClient();
  });

  test.afterAll(async () => {
    for (const id of createdUserIds) await deleteDisposableUser(admin, id).catch(() => undefined);
  });

  test("signup validates the password rules in the browser before submitting", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /start with what you own/i })).toBeVisible();
    await expect(page.getByText(/at least 15 characters/i)).toBeVisible();

    // The confirmation field is what a typo in an unreadable input runs into.
    await page.getByLabel("First name").fill("Sam");
    await page.getByLabel("Email address").fill(`e2e-${randomUUID()}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill(STRONG_PASSWORD);
    await page.getByLabel("Confirm password").fill("a different password entirely");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /create my wardrobe/i }).click();
    await expect(page).toHaveURL(/\/signup\?error=/);
  });

  test("show/hide reveals the password and announces its state", async ({ page }) => {
    await page.goto("/login");
    const field = page.getByLabel("Password", { exact: true });
    await field.fill("visible-check");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(field).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: /hide password/i })).toBeVisible();
  });

  test("signs up, confirms by email, and lands on onboarding", async ({ page }) => {
    await clearMailbox();
    const email = `e2e-${randomUUID()}@example.com`;

    await page.goto("/signup");
    await page.getByLabel("First name").fill("Sam");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(STRONG_PASSWORD);
    await page.getByLabel("Confirm password").fill(STRONG_PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /create my wardrobe/i }).click();

    // "Check your email" is distinct from "account created": nothing works yet.
    await expect(page).toHaveURL(/\/check-email/);
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
    // The address must not travel in the URL.
    expect(page.url()).not.toContain(email);

    const link = extractAuthLink(await waitForEmail(email));
    await page.goto(link);
    await expect(page).toHaveURL(/\/onboarding/);

    const { data } = await admin.auth.admin.listUsers();
    const created = data.users.find((user) => user.email === email);
    expect(created).toBeDefined();
    createdUserIds.push(created!.id);

    // Signup wrote the authoritative acceptance record.
    const { data: acceptance } = await admin
      .from("legal_acceptances")
      .select("source")
      .eq("user_id", created!.id);
    expect(acceptance).toHaveLength(1);
    expect(acceptance?.[0]?.source).toBe("signup");
  });

  test("resends a confirmation without revealing whether the account exists", async ({ page }) => {
    await page.goto("/check-email");
    // The resend form is inside a <details>. Opening it is one click on the
    // summary — clicking the group as well toggled it straight back shut, and
    // the field then never became visible.
    await page.locator("details summary").click();
    const email = page.getByLabel("Email address");
    await expect(email).toBeVisible();
    await email.fill(`nobody-${randomUUID()}@example.com`);
    await page.getByRole("button", { name: /resend confirmation link/i }).click();
    await expect(page.getByText(/if that email needs confirming/i)).toBeVisible();
  });

  test("logs in, returns to the requested page, and can sign out again", async ({ page }) => {
    const user = await createDisposableUser(admin);
    createdUserIds.push(user.id);

    // A protected page redirects to login and remembers where we were going.
    await page.goto("/wardrobe");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fwardrobe/);

    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: /log in securely/i }).click();
    await expect(page).toHaveURL(/\/wardrobe/);

    // Both layouts ship a "Sign out": the sidebar's and the mobile top bar's,
    // both in the DOM at once with only one shown. Filtering to the visible one
    // keeps this working on either viewport, where naming a single container
    // would pass on one project and hang on the other. Asserting the count
    // first is what makes that safe: until the stylesheet has applied, *both*
    // are visible, and clicking straight away turns that instant into a strict
    // mode violation rather than waiting for the layout it is describing.
    const signOut = page.getByRole("button", { name: /^sign out$/i }).filter({ visible: true });
    await expect(signOut).toHaveCount(1);
    await signOut.click();
    await expect(page).toHaveURL(/\/login/);

    // And the protected page is protected again.
    await page.goto("/wardrobe");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fwardrobe/);
  });

  test("gives a generic error for a wrong password", async ({ page }) => {
    const user = await createDisposableUser(admin);
    createdUserIds.push(user.id);

    await signIn(page, user.email, "definitely not the password");
    const feedback = page.locator(".auth-feedback[role='alert']");
    await expect(feedback).toContainText(/email or password is incorrect/i);
    // It must not distinguish an unknown address from a wrong password.
    await signIn(page, `unknown-${randomUUID()}@example.com`, "definitely not the password");
    await expect(feedback).toContainText(/email or password is incorrect/i);
  });

  test("recovers a password end to end and signs in with the new one", async ({ page }) => {
    await clearMailbox();
    const user = await createDisposableUser(admin);
    createdUserIds.push(user.id);
    const newPassword = "an entirely different passphrase";

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/if an account exists/i)).toBeVisible();

    await page.goto(extractAuthLink(await waitForEmail(user.email)));
    await expect(page).toHaveURL(/\/reset-password/);

    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: /save new password/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/other sessions were signed out/i)).toBeVisible();

    // The new password works, and the reset link cannot be replayed.
    await signIn(page, user.email, newPassword);
    await expect(page).toHaveURL(/\/today|\/wardrobe|\/accept-terms/);
  });

  test("a used reset link cannot be replayed", async ({ page }) => {
    await clearMailbox();
    const user = await createDisposableUser(admin);
    createdUserIds.push(user.id);

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByRole("button", { name: /send reset link/i }).click();

    const link = extractAuthLink(await waitForEmail(user.email));
    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill("first replacement passphrase");
    await page.getByLabel("Confirm new password").fill("first replacement passphrase");
    await page.getByRole("button", { name: /save new password/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Revisiting the same one-time link must not grant another reset.
    await page.goto(link);
    await expect(page).not.toHaveURL(/\/reset-password$/);
  });

  test("Settings shows the real email, providers, and MFA state", async ({ page }) => {
    const user = await createDisposableUser(admin);
    createdUserIds.push(user.id);

    await signIn(page, user.email, user.password);
    await page.goto("/settings");

    const security = page.locator("#settings-security");
    // This section is populated from /api/account/security, so the first
    // assertion waits on a real round trip rather than the 5s default.
    await expect(security.getByText(user.email)).toBeVisible({ timeout: 30_000 });
    await expect(security.getByText(/confirmed/i).first()).toBeVisible();
    await expect(security.getByText(/email and password/i)).toBeVisible();
    await expect(
      security.getByRole("heading", { name: /two-factor authentication/i }),
    ).toBeVisible();
    await expect(
      security.getByRole("button", { name: /set up an authenticator app/i }),
    ).toBeVisible();
  });

  test("offers all three sign-out scopes, each labelled by its reach", async ({ page }) => {
    const user = await createDisposableUser(admin);
    createdUserIds.push(user.id);

    await signIn(page, user.email, user.password);
    await page.goto("/settings");

    const security = page.locator("#settings-security");
    await expect(security.getByRole("button", { name: /sign out this device/i })).toBeVisible();
    await expect(security.getByRole("button", { name: /sign out other devices/i })).toBeVisible();
    await expect(security.getByRole("button", { name: /sign out everywhere/i })).toBeVisible();

    await security.getByRole("button", { name: /sign out other devices/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    // Still signed in here: that is what "other devices" means.
    await expect(page.locator("#settings-security")).toBeVisible();
  });

  test("downloads an account export", async ({ page }) => {
    const user = await createDisposableUser(admin);
    createdUserIds.push(user.id);

    await signIn(page, user.email, user.password);
    await page.goto("/settings");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /request export/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^wardrobe-ai-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test("deletes an account and lands on the public confirmation page", async ({ page }) => {
    const user = await createDisposableUser(admin);

    await signIn(page, user.email, user.password);
    await page.goto("/settings");

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: /^delete account$/i }).click();

    // Scoped to the deletion group: Settings also carries a "Current password"
    // field for changing the password, and an unscoped label matches both.
    const deletion = page.getByRole("group", { name: /confirm account deletion/i });
    await deletion.getByLabel("Deletion confirmation").fill("DELETE");
    await deletion.getByLabel("Current password").fill(user.password);
    await deletion.getByRole("button", { name: /permanently delete account/i }).click();

    // Deletion removes the Auth user and enqueues every stored object before it
    // redirects, so this waits on real work rather than the 5s default.
    await expect(page).toHaveURL(/\/account-deleted/, { timeout: 30_000 });
    // The copy must separate immediate removal from pending file cleanup.
    await expect(page.getByText(/being erased from storage/i)).toBeVisible();

    const { data } = await admin.auth.admin.getUserById(user.id);
    expect(data.user).toBeNull();
  });
});

test.describe("unconfigured demo mode", () => {
  test("keeps the auth pages viewable while offering no disabled provider buttons", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /open your wardrobe/i })).toBeVisible();
    // Google is off for this run, so the button must be absent, not disabled.
    await expect(page.getByRole("button", { name: /continue with google/i })).toHaveCount(0);
    // And no CAPTCHA widget is rendered when the flag is off.
    await expect(page.locator(".cf-turnstile")).toHaveCount(0);
  });
});
