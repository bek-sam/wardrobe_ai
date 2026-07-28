import { DEFAULT_SIGNED_IN_PATH, RETURN_TO_MAX_LENGTH } from "./constants";

// Resolving against an origin that cannot exist means any candidate which
// manages to change the origin (absolute URL, protocol-relative, or an escape
// that survives normalization) is trivially detectable by comparison.
const PLACEHOLDER_ORIGIN = "https://return-to.invalid";

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    // C0 controls, DEL, and the C1 range. A newline here could otherwise be
    // used to smuggle a second header into a redirect.
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

function escapesOrigin(value: string): boolean {
  return (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacter(value)
  );
}

/**
 * The single sanitizer for every post-authentication destination. Returns a
 * same-origin path or the fallback — never a value that could send a user to
 * another site with their freshly issued session.
 *
 * Accepts `unknown` because destinations arrive from form fields, query
 * strings (where Next.js may hand back an array), and JSON bodies alike.
 */
export function safeReturnTo(value: unknown, fallback: string = DEFAULT_SIGNED_IN_PATH): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const candidate = typeof raw === "string" ? raw.trim() : "";
  if (!candidate || candidate.length > RETURN_TO_MAX_LENGTH || escapesOrigin(candidate)) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return fallback; // Malformed percent-encoding, e.g. "/%E0%A4%A".
  }
  // "/%2f%2fevil.example" and "/%5cevil.example" only reveal themselves once
  // decoded, so the same rules are applied to the decoded form.
  if (escapesOrigin(decoded)) return fallback;

  try {
    const resolved = new URL(candidate, PLACEHOLDER_ORIGIN);
    if (resolved.origin !== PLACEHOLDER_ORIGIN) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
