import { describe, expect, it } from "vitest";

import { safeReturnTo } from "@/features/auth/schemas";

describe("safe auth redirects", () => {
  it("allows only same-origin absolute paths", () => {
    expect(safeReturnTo("/wardrobe?favorite=true")).toBe("/wardrobe?favorite=true");
    expect(safeReturnTo("https://example.com")).toBe("/today");
    expect(safeReturnTo("//example.com")).toBe("/today");
    expect(safeReturnTo("/\\example.com")).toBe("/today");
    expect(safeReturnTo(null)).toBe("/today");
  });
});
