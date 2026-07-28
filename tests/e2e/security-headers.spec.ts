import { expect, test } from "@playwright/test";

/**
 * Response-header regressions.
 *
 * The dev server runs with NODE_ENV=development, so `script-src` legitimately
 * carries the development relaxations here. What can still be asserted against
 * a running server is everything that must hold in *both* modes: a nonce is
 * present, sources are exact, framing is refused, and auth responses are never
 * publicly cacheable. The production-only shape of `script-src` is asserted in
 * tests/unit/auth-csp-cookies.test.ts, which builds the policy directly.
 */

async function policyFor(
  url: string,
  request: { get: (u: string) => Promise<{ headers: () => Record<string, string> }> },
) {
  const response = await request.get(url);
  return response.headers()["content-security-policy"] ?? "";
}

test("every page carries a per-request CSP nonce", async ({ request }) => {
  const first = await policyFor("/login", request);
  const second = await policyFor("/login", request);

  expect(first).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/);
  // A reused nonce would be no better than unsafe-inline.
  expect(first).not.toBe(second);
});

test("the policy pins exact origins and refuses framing", async ({ request }) => {
  const policy = await policyFor("/login", request);

  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("form-action 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toMatch(/(^|[ ;])\*/);
  expect(policy).not.toMatch(/ https:(?=[ ;]|$)/);
});

test("Turnstile is absent from the policy when CAPTCHA is off", async ({ request }) => {
  expect(await policyFor("/login", request)).not.toContain("cloudflare");
});

test("the standard hardening headers are present", async ({ request }) => {
  const headers = (await request.get("/login")).headers();

  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("auth pages are never publicly cacheable", async ({ request }) => {
  for (const path of ["/login", "/signup", "/forgot-password", "/check-email"]) {
    const cacheControl = (await request.get(path)).headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).not.toContain("public");
  }
});

test("auth POST routes reject a cross-origin submission", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    headers: { origin: "https://evil.example" },
    form: { email: "someone@example.com", password: "whatever" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});

test("the service-role key never reaches a client bundle", async ({ page }) => {
  const scriptBodies: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/_next/static/") && response.url().endsWith(".js")) {
      scriptBodies.push(await response.text().catch(() => ""));
    }
  });

  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  expect(serviceRoleKey.length).toBeGreaterThan(0);
  for (const body of scriptBodies) {
    expect(body).not.toContain(serviceRoleKey);
    expect(body).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(body).not.toContain("AUTH_ACTION_SECRET");
    expect(body).not.toContain("AUTH_RATE_LIMIT_HMAC_SECRET");
  }
});
