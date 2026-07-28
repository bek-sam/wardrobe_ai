import { defineConfig, devices } from "@playwright/test";

import { applyLocalSupabaseEnv } from "./tests/e2e/local-supabase-env";

// Resolved at config load so the dev server Playwright starts and the specs
// share one local Supabase instance. Returns false (and skips the
// authenticated specs) when Supabase is not running.
applyLocalSupabaseEnv();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
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
