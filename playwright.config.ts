import { defineConfig, devices } from "@playwright/test";

import { applyLocalSupabaseEnv } from "./tests/e2e/local-supabase-env";

// Resolved at config load so the dev server Playwright starts and the specs
// share one local Supabase instance. Returns false (and skips the
// authenticated specs) when Supabase is not running.
applyLocalSupabaseEnv();

export default defineConfig({
  testDir: "./tests/e2e",
  // Compiles every route once before the first test, so `next dev`'s on-demand
  // build never lands inside an assertion's timeout.
  globalSetup: "./tests/e2e/warm-dev-server.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // One worker everywhere, not just in CI. Every spec drives the *same* Next
  // dev server, which compiles routes on first request, and the same Supabase
  // instance. Playwright's default (half the cores) puts five browsers on that
  // one server: requests then miss even a 15s assertion, and submissions
  // appeared to do nothing at all — failures that say something about this
  // machine rather than about the app. Serial keeps the suite deterministic and
  // matches how CI already runs it.
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  // Every assertion here waits on a Next dev server that compiles routes on
  // first hit and on real Supabase round trips, while several workers share
  // both. Playwright's 5s default is a timing assumption, not a contract: a
  // slow-but-correct app failed on it constantly, and an actually broken one
  // still fails — just 10s later. Per-test timeouts stay where a specific step
  // needs more (streaming a chat turn, deleting an account).
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Authenticated specs need the app pointed at local Supabase. No OpenAI
      // variable is passed: the routes they exercise are deterministic, and
      // leaving the models unset also proves chat works without them.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      // Signup is exercised end to end, so it must be on for this run.
      PUBLIC_SIGNUP_ENABLED: "true",
      // Names the header tests/e2e/fixtures.ts sets, so the pre-auth limiter
      // sees one client per test instead of collapsing the whole suite into
      // the single shared bucket localhost would otherwise produce. The
      // limiter stays on; it just gets a truthful client identity.
      TRUSTED_CLIENT_IP_HEADER: "x-e2e-client-ip",
      // Obviously fake, fixed test keys. They only need to satisfy the 32-char
      // minimum; nothing they sign leaves this machine, and no real secret
      // belongs in a checked-in config file.
      AUTH_ACTION_SECRET: "e2e-auth-action-secret-0000000000000000000000000000000000",
      AUTH_RATE_LIMIT_HMAC_SECRET: "e2e-rate-limit-secret-0000000000000000000000000000000000",
      // CAPTCHA and Google stay off: neither can be driven without a live
      // third-party service, and their absence is itself asserted.
      NEXT_PUBLIC_CAPTCHA_ENABLED: "false",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
      NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED: "false",
    },
  },
});
