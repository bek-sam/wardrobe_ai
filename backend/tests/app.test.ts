import { describe, expect, it } from "vitest";

import { GET as health } from "../src/app/api/v1/health/route";

describe("backend process contract", () => {
  it("serves a versioned no-store health response", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      service: "backend",
      status: "ok",
    });
  });
});
