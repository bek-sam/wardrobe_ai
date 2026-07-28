import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

import { buildContentSecurityPolicy } from "./content-security-policy";

/**
 * Copies the incoming headers and adds the nonce.
 *
 * Next.js reads the nonce out of the *request's* `Content-Security-Policy`
 * header and stamps it onto the framework's own inline bootstrap scripts.
 * Without this the response policy would reject the very scripts Next needs to
 * hydrate the page, and `x-nonce` gives server components a way to read it for
 * any script they render themselves.
 */
function headersWithNonce(request: NextRequest, nonce: string): Headers {
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  return headers;
}

export function createSessionClient(
  request: NextRequest,
  supabaseUrl: string,
  publishableKey: string,
  nonce: string,
) {
  let response = NextResponse.next({ request: { headers: headersWithNonce(request, nonce) } });

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookieOptions: supabaseCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Refreshed cookies are written back onto the request first, so a
        // server component rendered later in this same pass reads the new
        // session rather than the one that just expired.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: headersWithNonce(request, nonce) } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return { supabase, getResponse: () => response };
}
