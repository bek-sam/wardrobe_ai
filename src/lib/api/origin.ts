import { NextResponse } from "next/server";
import { getServerEnvironment } from "@/lib/env/server";

function trustedOrigins(request: Request): Set<string> {
  const trusted = new Set([new URL(request.url).origin]);
  trusted.add(new URL(getServerEnvironment().NEXT_PUBLIC_APP_URL).origin);
  return trusted;
}

/**
 * Browsers always send an Origin header on cross-site POSTs, so rejecting
 * mismatched origins blocks form-based CSRF (an attacker's page submitting a
 * cross-site form to attach the victim's session cookie via a top-level
 * navigation, which SameSite=Lax does not block). When Origin is absent, fall
 * back to Referer so we are not relying solely on SameSite cookie defaults.
 * Requests with neither header (curl, native clients) carry no ambient
 * browser session to forge and are treated as trusted.
 */
export function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin !== "null" && trustedOrigins(request).has(origin);

  const referer = request.headers.get("referer");
  if (!referer) return true;
  try {
    return trustedOrigins(request).has(new URL(referer).origin);
  } catch {
    return false;
  }
}

export function rejectUntrustedOrigin(request: Request): NextResponse | null {
  if (isTrustedOrigin(request)) return null;
  return NextResponse.json(
    {
      error: {
        code: "invalid_origin",
        message: "Cross-origin form submissions are not allowed.",
      },
    },
    { status: 403 },
  );
}
