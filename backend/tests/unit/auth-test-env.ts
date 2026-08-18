/**
 * Environment the auth routes need before their modules are imported.
 *
 * The server environment schema is parsed once and cached, so every test file
 * that imports an auth route must set these first — importing the route pulls
 * in the schema, and a later assignment would come too late.
 *
 * The secrets are fixed, obviously fake, 64-character strings: long enough to
 * satisfy the schema's minimum, and clearly not derived from anything real.
 */
export const TEST_APP_URL = "http://localhost:3000";

export function applyAuthTestEnvironment(overrides: Record<string, string> = {}) {
  Object.assign(process.env, {
    NEXT_PUBLIC_APP_URL: TEST_APP_URL,
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    AUTH_ACTION_SECRET: "a".repeat(64),
    AUTH_RATE_LIMIT_HMAC_SECRET: "b".repeat(64),
    PUBLIC_SIGNUP_ENABLED: "true",
    NEXT_PUBLIC_CAPTCHA_ENABLED: "false",
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED: "false",
    ...overrides,
  });
}
