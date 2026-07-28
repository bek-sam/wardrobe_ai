import { describe, expect, it } from "vitest";

import { RETURN_TO_MAX_LENGTH } from "@/lib/auth/constants";
import { safeReturnTo } from "@/lib/auth/redirects";

describe("safeReturnTo", () => {
  it("allows same-origin absolute paths and preserves query and hash", () => {
    expect(safeReturnTo("/wardrobe?favorite=true")).toBe("/wardrobe?favorite=true");
    expect(safeReturnTo("/planner#week")).toBe("/planner#week");
    expect(safeReturnTo("/")).toBe("/");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeReturnTo("https://example.com")).toBe("/today");
    expect(safeReturnTo("http://example.com/today")).toBe("/today");
    expect(safeReturnTo("//example.com")).toBe("/today");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/today");
    expect(safeReturnTo("data:text/html,<script>")).toBe("/today");
  });

  it("rejects backslash tricks that some browsers normalize to a slash", () => {
    expect(safeReturnTo("/\\example.com")).toBe("/today");
    expect(safeReturnTo("\\\\example.com")).toBe("/today");
    expect(safeReturnTo("/path\\..\\..")).toBe("/today");
  });

  it("rejects encodings that only escape the origin once decoded", () => {
    expect(safeReturnTo("/%2f%2fexample.com")).toBe("/today");
    expect(safeReturnTo("/%5c%5cexample.com")).toBe("/today");
    expect(safeReturnTo("/%09/example.com")).toBe("/today");
  });

  it("rejects malformed percent-encoding rather than throwing", () => {
    expect(safeReturnTo("/%E0%A4%A")).toBe("/today");
    expect(safeReturnTo("/%")).toBe("/today");
  });

  it("rejects control characters that could smuggle a header", () => {
    expect(safeReturnTo("/today\nLocation: https://example.com")).toBe("/today");
    expect(safeReturnTo("/today\r\nSet-Cookie: a=b")).toBe("/today");
  });

  it("rejects values longer than the bound", () => {
    expect(safeReturnTo(`/${"a".repeat(RETURN_TO_MAX_LENGTH)}`)).toBe("/today");
  });

  it("handles non-string and array inputs from query parsing", () => {
    expect(safeReturnTo(null)).toBe("/today");
    expect(safeReturnTo(undefined)).toBe("/today");
    expect(safeReturnTo(42)).toBe("/today");
    expect(safeReturnTo(["/outfits", "/evil"])).toBe("/outfits");
  });

  it("uses the supplied fallback", () => {
    expect(safeReturnTo("https://example.com", "/settings")).toBe("/settings");
  });

  it("normalizes traversal back inside the origin", () => {
    expect(safeReturnTo("/a/../../b")).toBe("/b");
  });
});
