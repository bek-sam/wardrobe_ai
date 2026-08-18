import { describe, expect, it } from "vitest";

import { carriedDestination, resolveRoute } from "@/lib/proxy";

describe("frontend authentication routing policy", () => {
  it("redirects anonymous private-page requests and permits public routes", () => {
    expect(resolveRoute("/wardrobe", { signedIn: false, needsMfa: false })).toEqual({
      kind: "redirect",
      pathname: "/login",
      carryReturnTo: true,
    });
    for (const path of [
      "/",
      "/login",
      "/check-email",
      "/reset-password",
      "/auth/callback/recovery",
    ]) {
      expect(resolveRoute(path, { signedIn: false, needsMfa: false })).toEqual({
        kind: "continue",
      });
    }
  });

  it("holds under-assured sessions at MFA but permits challenge completion and API calls", () => {
    expect(resolveRoute("/wardrobe", { signedIn: true, needsMfa: true })).toMatchObject({
      kind: "redirect",
      pathname: "/mfa/verify",
    });
    for (const path of [
      "/mfa/verify",
      "/reset-password",
      "/privacy",
      "/terms",
      "/api/auth/logout",
    ]) {
      expect(resolveRoute(path, { signedIn: true, needsMfa: true })).toEqual({ kind: "continue" });
    }
  });

  it("keeps a signed-in visitor's carried destination on a signed-out-only page", () => {
    // Landing here already authenticated is ordinary: a cancelled post-login
    // redirect puts the browser back on /login with the session in place. The
    // destination has to survive that, or the user silently loses their page.
    for (const path of ["/login", "/signup", "/forgot-password", "/magic-link"]) {
      expect(resolveRoute(path, { signedIn: true, needsMfa: false })).toMatchObject({
        kind: "redirect",
        honorReturnTo: true,
      });
    }
    // Assurance still comes first: an under-assured session never gets here.
    expect(resolveRoute("/login", { signedIn: true, needsMfa: true })).toMatchObject({
      kind: "redirect",
      pathname: "/mfa/verify",
    });
  });

  it("unwraps and re-sanitizes signed-out-page destinations", () => {
    const at = (path: string) => new URL(path, "https://wardrobe.test");
    expect(carriedDestination(at("/wardrobe?sort=recent"))).toBe("/wardrobe?sort=recent");
    expect(carriedDestination(at("/login?returnTo=%2Fwardrobe"))).toBe("/wardrobe");
    expect(carriedDestination(at("/login?returnTo=https%3A%2F%2Fevil.example"))).toBe("/today");
  });
});
