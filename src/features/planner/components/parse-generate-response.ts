import { isObject } from "@/lib/api/normalize";

export function parseGenerateResponse(result: unknown): string {
  if (!isObject(result) || !Array.isArray(result.looks) || !Array.isArray(result.saved)) {
    throw new Error("The generated plan response was invalid.");
  }
  const missing = Array.isArray(result.missingCategories)
    ? result.missingCategories.filter((entry): entry is string => typeof entry === "string")
    : [];
  return `${result.saved.length} ${result.saved.length === 1 ? "look" : "looks"} planned${
    missing.length ? `. Missing categories: ${missing.join(", ")}.` : "."
  }`;
}
