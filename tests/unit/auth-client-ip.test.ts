import { afterEach, describe, expect, it, vi } from "vitest";

import { applyAuthTestEnvironment } from "./auth-test-env";

/**
 * The client IP feeds a rate-limit bucket, so the property that matters is not
 * "does it parse an address" but "does it ever trust one it should not". A
 * spoofable value would let an attacker mint a fresh bucket per request, which
 * is strictly worse than no IP limiting because it looks like protection.
 */
async function readIp(headers: Record<string, string>, trustedHeader?: string) {
  vi.resetModules();
  applyAuthTestEnvironment();
  if (trustedHeader) process.env.TRUSTED_CLIENT_IP_HEADER = trustedHeader;
  else delete process.env.TRUSTED_CLIENT_IP_HEADER;

  const { trustedClientIp } = await import("@/lib/api/client-ip");
  return trustedClientIp(new Request("http://localhost:3000/api/auth/login", { headers }));
}

afterEach(() => {
  vi.resetModules();
  applyAuthTestEnvironment();
});

describe("trustedClientIp", () => {
  it("returns null when no header is configured, however tempting the request looks", async () => {
    expect(await readIp({ "x-forwarded-for": "203.0.113.9" })).toBeNull();
    expect(await readIp({ "x-real-ip": "203.0.113.9" })).toBeNull();
    expect(await readIp({ "cf-connecting-ip": "203.0.113.9" })).toBeNull();
  });

  it("reads only the configured header, ignoring every other candidate", async () => {
    const ip = await readIp(
      { "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.1" },
      "x-vercel-forwarded-for",
    );
    expect(ip).toBe("203.0.113.9");
  });

  it("returns null when the configured header is absent", async () => {
    expect(await readIp({ "x-forwarded-for": "203.0.113.9" }, "x-vercel-forwarded-for")).toBeNull();
  });

  it("takes the left-most entry of a forwarded chain", async () => {
    const ip = await readIp(
      { "x-vercel-forwarded-for": "203.0.113.9, 198.51.100.1, 192.0.2.7" },
      "x-vercel-forwarded-for",
    );
    expect(ip).toBe("203.0.113.9");
  });

  it("unwraps an IPv4-mapped IPv6 address so both forms share one bucket", async () => {
    expect(await readIp({ "x-real-ip": "::ffff:203.0.113.9" }, "x-real-ip")).toBe("203.0.113.9");
  });

  it("accepts IPv6 and normalizes its case", async () => {
    expect(await readIp({ "x-real-ip": "2001:DB8::1" }, "x-real-ip")).toBe("2001:db8::1");
  });

  it("rejects values that are not addresses, rather than bucketing junk", async () => {
    for (const value of [
      "not-an-ip",
      "999.1.1.1",
      "1.2.3",
      "",
      "  ",
      "<script>",
      "203.0.113.9;drop",
    ]) {
      expect(await readIp({ "x-real-ip": value }, "x-real-ip")).toBeNull();
    }
  });

  it("rejects a hostname that merely looks routable", async () => {
    expect(await readIp({ "x-real-ip": "evil.example" }, "x-real-ip")).toBeNull();
  });

  it("trims surrounding whitespace from a well-formed value", async () => {
    expect(await readIp({ "x-real-ip": "  203.0.113.9  " }, "x-real-ip")).toBe("203.0.113.9");
  });
});
