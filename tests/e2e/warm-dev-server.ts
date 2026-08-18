/**
 * Warms the routes the suite uses before any test measures them.
 *
 * The production server still initializes route caches and external clients on
 * first use. Fetching each route once keeps that one-time work outside the
 * assertions, so a timeout reflects the workflow rather than suite ordering.
 *
 * Failures are ignored on purpose: a protected route answers with a redirect
 * and an unconfigured one may error. Either way the module graph is built,
 * which is the whole point. Nothing here asserts anything.
 */
const ROUTES = [
  "/",
  "/login",
  "/signup",
  "/check-email",
  "/forgot-password",
  "/reset-password",
  "/magic-link",
  "/mfa/verify",
  "/account-deleted",
  "/privacy",
  "/terms",
  "/onboarding",
  "/today",
  "/wardrobe",
  "/stylist",
  "/studio",
  "/settings",
];

/**
 * Outfit Studio calls several handlers inside one assertion window. Warming
 * them with a deliberately invalid body initializes the server path without
 * mutating product data; the expected 401/422 response is discarded.
 */
const API_ROUTES = ["/api/items/cutouts", "/api/outfits/variants", "/api/outfit-visualizations"];

async function reachable(baseURL: string): Promise<boolean> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(new URL("/login", baseURL));
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

export default async function warmServer() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  if (!(await reachable(baseURL))) return;

  // Sequential, not parallel: the point is to let the compiler finish one route
  // at a time rather than to recreate the stampede this exists to prevent.
  for (const route of ROUTES) {
    await fetch(new URL(route, baseURL), { redirect: "manual" }).catch(() => undefined);
  }
  for (const route of API_ROUTES) {
    await fetch(new URL(route, baseURL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      redirect: "manual",
    }).catch(() => undefined);
  }
}
