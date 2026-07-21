import { NextResponse } from "next/server";
import { getServerEnvironment } from "@/lib/env/server";

/**
 * Browsers always send an Origin header on cross-site POSTs, so rejecting
 * mismatched origins blocks login CSRF (an attacker's page submitting our auth
 * forms to attach their session or trigger emails). Requests without an Origin
 * header (curl, native clients) carry no ambient browser state to forge.
 */
export function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;
  const trusted = new Set([new URL(request.url).origin]);
  trusted.add(new URL(getServerEnvironment().NEXT_PUBLIC_APP_URL).origin);
  return trusted.has(origin);
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
