import type { NextResponse } from "next/server";

import { buildContentSecurityPolicy } from "./content-security-policy";

/**
 * Applies the per-request CSP and marks every proxied response uncacheable.
 *
 * The CSP is set here rather than in `next.config.ts` because it carries a
 * fresh nonce per request; a statically configured header cannot do that, and
 * a static header is what forced `script-src 'unsafe-inline'` before. The
 * remaining headers stay in `next.config.ts`, which is the right home for
 * values that never vary.
 */
export function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
