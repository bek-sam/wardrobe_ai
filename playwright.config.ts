import { defineConfig, devices } from "@playwright/test";

import { applyLocalSupabaseEnv } from "./tests/e2e/local-supabase-env";

// Resolved at config load so the dev server Playwright starts and the specs
// share one local Supabase instance. Returns false (and skips the
// authenticated specs) when Supabase is not running.
applyLocalSupabaseEnv();

export default defineConfig({
  testDir: "./tests/e2e",
  // Touches every route once before the first test so caches and external
  // connections are warm before an assertion measures them.
  globalSetup: "./tests/e2e/warm-dev-server.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // One worker everywhere, not just in CI. Every spec drives the same Next
  // server and Supabase instance. Playwright's default (half the cores) puts
  // several browsers on that shared state and makes request timing and auth
  // cleanup nondeterministic. Serial execution matches CI.
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  // Assertions include real Supabase round trips. Playwright's 5s default is a
  // timing assumption, not a product contract; per-test timeouts stay where a
  // specific workflow needs more (streaming a turn, deleting an account).
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
      // The full desktop + mobile run compiles every route into one HMR graph.
      // Keep Next from restarting mid-suite at its default heap ceiling.
      NODE_OPTIONS: "--max-old-space-size=8192",
      // Authenticated specs need the app pointed at local Supabase. No OpenAI
      // variable is passed: the routes they exercise are deterministic, and
      // leaving the models unset also proves chat works without them.
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_STORAGE_ORIGIN: process.env.NEXT_PUBLIC_STORAGE_ORIGIN ?? "",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      AI_ORCHESTRATION_URL: "http://127.0.0.1:3002",
      AI_SERVICE_TOKEN: "e2e-ai-workload-token-0000000000000000000000000000000000",
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
      // Outfit Studio try-on runs against the deterministic, network-free fake
      // provider. It produces a real portrait PNG and typed QA/localization
      // results, so the whole pipeline is exercised without an OpenAI key and
      // without a paid call. Inline processing stands in for the scheduler that
      // a dev server does not have.
      OUTFIT_VISUALIZATION_PROVIDER: "fake",
      OUTFIT_VISUALIZATION_FAKE_OUTCOME: "ready",
      // CAPTCHA and Google stay off: neither can be driven without a live
      // third-party service, and their absence is itself asserted.
      NEXT_PUBLIC_CAPTCHA_ENABLED: "false",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
      NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED: "false",
    },
  },
});
