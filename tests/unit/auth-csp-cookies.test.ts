import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function buildPolicy(env: Record<string, string | undefined>, nonce = "test-nonce") {
  vi.resetModules();
  Object.assign(process.env, env);
  const { buildContentSecurityPolicy } = await import("@/lib/proxy");
  return buildContentSecurityPolicy(nonce);
}

function directive(policy: string, name: string): string {
  return policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("production Content-Security-Policy", () => {
  const production = {
    NODE_ENV: "production",
    NEXT_PUBLIC_STORAGE_ORIGIN: "https://storage.example.com",
    NEXT_PUBLIC_CAPTCHA_ENABLED: "false",
  };

  it("carries no script unsafe-inline and no unsafe-eval", async () => {
    const scriptSrc = directive(await buildPolicy(production), "script-src");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("authorizes inline scripts by per-request nonce instead", async () => {
    expect(directive(await buildPolicy(production, "abc123"), "script-src")).toContain(
      "'nonce-abc123'",
    );
  });

  it("allows the configured signed-upload origin for data and image requests", async () => {
    const policy = await buildPolicy(production);
    expect(directive(policy, "connect-src")).toContain("https://storage.example.com");
    expect(directive(policy, "img-src")).toContain("https://storage.example.com");
  });

  it("adds no broad wildcard sources", async () => {
    const policy = await buildPolicy(production);
    expect(policy).not.toMatch(/(^|[ ;])\*/);
    // The bare `https:` scheme source, which would allow every HTTPS origin.
    // An exact storage origin such as `https://storage.example.com` is fine.
    expect(policy).not.toMatch(/ https:(?=[ ;]|$)/);
  });

  it("keeps the object, base, form, and framing restrictions", async () => {
    const policy = await buildPolicy(production);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("forbids framing entirely when CAPTCHA is off", async () => {
    expect(directive(await buildPolicy(production), "frame-src")).toBe("frame-src 'none'");
  });

  it("allows only Turnstile to be framed when CAPTCHA is on", async () => {
    const policy = await buildPolicy({ ...production, NEXT_PUBLIC_CAPTCHA_ENABLED: "true" });
    expect(directive(policy, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
    expect(directive(policy, "script-src")).toContain("https://challenges.cloudflare.com");
  });

  it("does not mention Cloudflare at all when CAPTCHA is off", async () => {
    expect(await buildPolicy(production)).not.toContain("cloudflare");
  });
});

describe("development Content-Security-Policy", () => {
  it("relaxes script sources only under next dev", async () => {
    const policy = await buildPolicy({
      NODE_ENV: "development",
      NEXT_PUBLIC_STORAGE_ORIGIN: "http://127.0.0.1:54321",
      NEXT_PUBLIC_CAPTCHA_ENABLED: "false",
    });
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "connect-src")).toContain("ws:");
  });
});

/**
 * The response headers the proxy stamps on every request it handles.
 *
 * Asserted here rather than end to end because `next dev` overwrites
 * `Cache-Control` on HTML document responses with its own
 * `no-cache, must-revalidate`, so a dev server can never show this contract
 * holding. Reading the function directly is the honest test of it.
 */
describe("proxy security headers", () => {
  async function applyTo(nonce = "test-nonce") {
    vi.resetModules();
    const { NextResponse } = await import("next/server");
    const { applySecurityHeaders } = await import("@/lib/proxy");
    return applySecurityHeaders(NextResponse.json({}), nonce);
  }

  it("keeps every proxied response out of shared and private caches alike", async () => {
    const cacheControl = (await applyTo()).headers.get("Cache-Control") ?? "";
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
  });

  it("stamps the per-request nonce into the policy it sets", async () => {
    const policy = (await applyTo("abc123")).headers.get("Content-Security-Policy") ?? "";
    expect(policy).toContain("'nonce-abc123'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
