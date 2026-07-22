import { describe, expect, it } from "vitest";

import { isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/api/origin";
import { POST as createWardrobeItem } from "@/app/api/items/route";

const APP_URL = "http://localhost:3000";

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(new URL(path, APP_URL), { method: "POST", headers });
}

describe("isTrustedOrigin", () => {
  it("trusts a same-origin Origin header", () => {
    expect(isTrustedOrigin(request("/api/items", { origin: APP_URL }))).toBe(true);
  });

  it("rejects a forged cross-site Origin header", () => {
    expect(isTrustedOrigin(request("/api/items", { origin: "https://evil.example" }))).toBe(false);
  });

  it("rejects the literal 'null' Origin sent by sandboxed/opaque contexts", () => {
    expect(isTrustedOrigin(request("/api/items", { origin: "null" }))).toBe(false);
  });

  it("falls back to a same-origin Referer when Origin is absent", () => {
    expect(isTrustedOrigin(request("/api/items", { referer: `${APP_URL}/wardrobe` }))).toBe(true);
  });

  it("rejects a forged cross-site Referer when Origin is absent", () => {
    expect(isTrustedOrigin(request("/api/items", { referer: "https://evil.example/attack" }))).toBe(
      false,
    );
  });

  it("rejects an unparseable Referer when Origin is absent", () => {
    expect(isTrustedOrigin(request("/api/items", { referer: "not-a-url" }))).toBe(false);
  });

  it("trusts requests with neither Origin nor Referer (non-browser clients)", () => {
    expect(isTrustedOrigin(request("/api/items"))).toBe(true);
  });
});

describe("rejectUntrustedOrigin", () => {
  it("returns null for a trusted request", () => {
    expect(rejectUntrustedOrigin(request("/api/items", { origin: APP_URL }))).toBeNull();
  });

  it("returns a 403 invalid_origin response for a forged Origin", async () => {
    const response = rejectUntrustedOrigin(
      request("/api/items", { origin: "https://evil.example" }),
    );
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.error.code).toBe("invalid_origin");
  });
});

describe("mutation routes reject forged cross-origin requests end-to-end", () => {
  it("POST /api/items rejects a forged Origin before touching auth or the database", async () => {
    const response = await createWardrobeItem(
      new Request(new URL("/api/items", APP_URL), {
        method: "POST",
        headers: { origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_origin");
  });
});
