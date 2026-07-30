import type { NextRequest } from "next/server";

import { runProxy } from "@/lib/proxy";

export async function proxy(request: NextRequest) {
  return runProxy(request);
}

/**
 * Static files served from `public/` carry no session and must stay reachable
 * signed out — the browser fetches the manifest and service worker without
 * credentials, so gating them turns every request into a redirect to /login.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico|txt|xml)$).*)",
  ],
};
