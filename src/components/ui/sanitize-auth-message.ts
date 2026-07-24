import { firstValue, type SearchParamValue } from "./search-param-value";

const MAX_MESSAGE_LENGTH = 240;

// Codepoint ranges to strip: C0 controls, DEL, and bidi override/isolate
// formatting characters that could otherwise visually spoof the rendered
// message. Checked by numeric codepoint rather than a regex literal to
// avoid embedding raw control bytes in this source file.
function isStrippedCodePoint(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    codePoint === 0x7f ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

function stripControlAndBidiCharacters(value: string): string {
  let result = "";
  for (const char of value) {
    result += isStrippedCodePoint(char.codePointAt(0) ?? 0) ? " " : char;
  }
  return result;
}

export function sanitizeAuthMessage(value: SearchParamValue): string | null {
  const candidate = firstValue(value);
  if (!candidate) return null;

  const normalized = stripControlAndBidiCharacters(candidate.normalize("NFKC"))
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);

  return normalized || null;
}
