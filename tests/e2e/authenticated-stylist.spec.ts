import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";

import {
  adminClient,
  createDisposableUser,
  deleteDisposableUser,
  e2eSupabaseConfig,
  seedRecordedPlan,
  seedWardrobe,
  type SeededUser,
} from "./seed";

/**
 * Authenticated coverage for the routes that need no model at all: a wardrobe
 * lookup and an insight, both answered from the user's own seeded rows, plus
 * the explicit plan-save action driven from a securely seeded planning run.
 * Nothing here calls OpenAI, so it runs in CI with no model secret.
 */
const supabaseReady = e2eSupabaseConfig() !== null;

test.describe("authenticated stylist", () => {
  test.skip(
    !supabaseReady,
    "Local Supabase is not configured. Run `npx supabase start` and re-run, or set " +
      "TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY.",
  );

  // The chat streams a real orchestrator turn; give it room beyond the default.
  test.setTimeout(120_000);

  let admin: SupabaseClient;
  let user: SeededUser;
  let items: { blazerId: string; topId: string; bottomId: string };

  test.beforeAll(async () => {
    admin = adminClient();
    user = await createDisposableUser(admin);
    items = await seedWardrobe(admin, user.id);
  });

  test.afterAll(async () => {
    if (user) await deleteDisposableUser(admin, user.id);
  });

  async function logIn(page: Page) {
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /log in securely/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  }

  // The composer is disabled while the conversation history loads and while a
  // turn streams, both of which are real round trips, so readiness is waited
  // for rather than assumed at the 5s default.
  const COMPOSER_READY_TIMEOUT = 30_000;

  async function ask(page: Page, question: string) {
    const composer = page.getByLabel(/ask your stylist/i);
    await expect(composer).toBeEnabled({ timeout: COMPOSER_READY_TIMEOUT });
    await composer.fill(question);

    // Send is the real readiness signal: ChatPanel enables it only once the
    // composer has text *and* the styling context (its date) has loaded, so the
    // textarea can be editable while the request would still be refused.
    const send = page.getByRole("button", { name: /send message/i });
    await expect(send).toBeEnabled({ timeout: COMPOSER_READY_TIMEOUT });
    await send.click();
  }

  test("answers a lowercase item question and an insight, and keeps both on reload", async ({
    page,
  }) => {
    await logIn(page);
    await page.goto("/stylist");

    // Chat is available on the account alone -- no OpenAI variable is set.
    await expect(page.getByRole("heading", { name: /your stylist/i })).toBeVisible();
    await expect(page.getByLabel(/ask your stylist/i)).toBeEnabled({
      timeout: COMPOSER_READY_TIMEOUT,
    });

    // 1. Deliberately lowercase: routing must not depend on capitalisation.
    await ask(page, "do i own a blue blazer?");
    const thread = page.locator(".chat-thread");
    await expect(thread.getByText(/blue blazer/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(thread.getByText(/^you own\b|\byes\b|\b1 match|\bown\b/i).first()).toBeVisible();

    // 2. An insight question, computed from the seeded wear history.
    await ask(page, "what have i not worn this year?");
    await expect(thread.getByText(/green corduroy trousers/i).first()).toBeVisible({
      timeout: 60_000,
    });

    const answersBeforeReload = await thread.locator(".chat-message--assistant").count();
    expect(answersBeforeReload).toBeGreaterThanOrEqual(2);

    // 3. Reload and re-open the conversation: both answers must survive.
    await page.reload();
    const historySelect = page.getByLabel(/recent chats/i);
    await expect(historySelect).toBeEnabled({ timeout: 30_000 });
    const conversationValue = await historySelect.locator("option").nth(1).getAttribute("value");
    await historySelect.selectOption(conversationValue ?? "");

    await expect(thread.getByText(/blue blazer/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(thread.getByText(/green corduroy trousers/i).first()).toBeVisible();
  });

  test("saves a chat plan explicitly, exactly once", async ({ page }) => {
    const { generationId, conversationId } = await seedRecordedPlan(admin, user.id, items);
    await logIn(page);
    await page.goto("/stylist");

    const historySelect = page.getByLabel(/recent chats/i);
    await expect(historySelect).toBeEnabled({ timeout: 30_000 });
    await historySelect.selectOption(conversationId);

    // The answer states it was not auto-saved and points at the action.
    const thread = page.locator(".chat-thread");
    await expect(thread.getByText(/not saved automatically/i)).toBeVisible({ timeout: 30_000 });

    const saveButton = page.getByRole("button", { name: /save plan/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.getByRole("status").filter({ hasText: /plan saved/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: /save plan/i })).toHaveCount(0);

    // The plan really landed, exactly once, and the transcript was updated.
    const { data: saves } = await admin
      .from("generated_plan_saves")
      .select("plan_id")
      .eq("generation_id", generationId);
    expect(saves).toHaveLength(1);

    const { data: message } = await admin
      .from("messages")
      .select("structured_result")
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .single();
    expect((message?.structured_result as { saved: boolean }).saved).toBe(true);

    // Reloading the conversation shows it as saved rather than re-offering it.
    await page.reload();
    await expect(historySelect).toBeEnabled({ timeout: 30_000 });
    await historySelect.selectOption(conversationId);
    await expect(page.getByRole("status").filter({ hasText: /plan saved/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: /save plan/i })).toHaveCount(0);
  });
});
