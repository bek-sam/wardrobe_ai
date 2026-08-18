import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnvironment = { ...process.env };

function setNodeEnvironment(value: string) {
  Object.assign(process.env, { NODE_ENV: value });
}

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.resetModules();
});

describe("backend session cookie options", () => {
  it("uses secure host-only cookies on HTTPS deployments", async () => {
    setNodeEnvironment("production");
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const { supabaseCookieOptions } = await import("@/lib/supabase/cookie-options");
    expect(supabaseCookieOptions()).toMatchObject({ path: "/", sameSite: "lax", secure: true });
    expect(supabaseCookieOptions().domain).toBeUndefined();
  });

  it("allows loopback HTTP without shortening the provider session", async () => {
    setNodeEnvironment("production");
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
    const { supabaseCookieOptions } = await import("@/lib/supabase/cookie-options");
    const options = supabaseCookieOptions();
    expect(options.secure).toBe(false);
    expect(options.maxAge).toBeUndefined();
    expect(options.expires).toBeUndefined();
  });
});
