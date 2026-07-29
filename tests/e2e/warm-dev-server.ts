/**
 * Compiles the routes the suite uses before any test measures them.
 *
 * `next dev` builds each route on its first request, which for this app is
 * seconds — occasionally tens of seconds for a page pulling in the stylist
 * workspace. Whichever project runs first therefore pays that cost inside its
 * assertions, and the same spec passes or fails depending only on whether some
 * earlier run happened to warm the route. Fetching each one once here moves the
 * compile out of the tests, so a timeout means the app was genuinely slow.
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
  "/settings",
];

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

export default async function warmDevServer() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  if (!(await reachable(baseURL))) return;

  // Sequential, not parallel: the point is to let the compiler finish one route
  // at a time rather than to recreate the stampede this exists to prevent.
  for (const route of ROUTES) {
    await fetch(new URL(route, baseURL), { redirect: "manual" }).catch(() => undefined);
  }
}
