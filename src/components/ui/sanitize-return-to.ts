import { firstValue, type SearchParamValue } from "./search-param-value";

const MAX_RETURN_TO_LENGTH = 500;

function containsControlCharacter(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) return true;
  }
  return false;
}

export function sanitizeReturnTo(value: SearchParamValue): string {
  const candidate = firstValue(value)?.trim();
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    containsControlCharacter(candidate)
  ) {
    return "/today";
  }
  return candidate.slice(0, MAX_RETURN_TO_LENGTH);
}
