import { test as base, expect } from "@playwright/test";

/**
 * Gives every test its own pre-auth rate-limit bucket.
 *
 * The limiter in src/lib/auth/rate-limit charges each action against both the
 * email and the client IP. `trustedClientIp` only reads an IP from the header
 * a deployment names in `TRUSTED_CLIENT_IP_HEADER`, and refuses to guess when
 * none is configured -- so on localhost every request collapses into one
 * shared "unknown proxy" bucket. A full run signs in far more than the 30
 * logins that bucket allows per 15 minutes, so the suite throttles itself and
 * later sign-ins fail for reasons that have nothing to do with what they test.
 *
 * Playwright's own config names the header for the dev server it starts, and
 * each test sends a distinct address through it. That is exactly the shape of
 * a real deployment behind a proxy that overwrites the header, so the limiter
 * stays fully switched on -- it simply stops treating the entire suite as one
 * abusive client. A test that wants to prove throttling can still exhaust its
 * own bucket.
 */
export const E2E_CLIENT_IP_HEADER = "x-e2e-client-ip";

let assigned = 0;

/** A distinct RFC 1918 address per test, in a range no real client uses here. */
function nextClientIp(): string {
  assigned += 1;
  // 10.<worker-ish>.<n>.<n> — three octets of room is far more than the number
  // of tests, and every octet stays within the 0-255 that trustedClientIp
  // requires before it will accept the value.
  const id = assigned + process.pid * 1000;
  return `10.${(id >> 16) & 0xff}.${(id >> 8) & 0xff}.${id & 0xff}`;
}

// Playwright names the second argument `use` by convention; it is called
// `runTest` here only because the react-hooks lint rule reads a call to
// anything named `use` as a misplaced React hook.
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await page.setExtraHTTPHeaders({ [E2E_CLIENT_IP_HEADER]: nextClientIp() });
    await runTest(page);
  },
});

export { expect };
