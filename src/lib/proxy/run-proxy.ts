import { type NextRequest, NextResponse } from "next/server";

import { copySessionCookies } from "./copy-session-cookies";
import { createNonce } from "./create-nonce";
import { createSessionClient } from "./create-session-client";
import { readSessionState } from "./read-session-state";
import { resolveRoute } from "./resolve-route";
import { applySecurityHeaders } from "./security-headers";

export async function runProxy(request: NextRequest) {
  const nonce = createNonce();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Demo mode: the marketing and auth pages still render so the design can be
  // reviewed, but with no Supabase configured nothing can authenticate — the
  // forms say so rather than pretending to work.
  if (!supabaseUrl || !publishableKey) {
    const response = applySecurityHeaders(NextResponse.next(), nonce);
    response.headers.set("x-wardrobe-configuration", "demo");
    return response;
  }

  const { supabase, getResponse } = createSessionClient(
    request,
    supabaseUrl,
    publishableKey,
    nonce,
  );
  const state = await readSessionState(supabase);
  const decision = resolveRoute(request.nextUrl.pathname, state);

  if (decision.kind === "redirect") {
    const target = request.nextUrl.clone();
    target.pathname = decision.pathname;
    target.search = "";
    if (decision.carryReturnTo) {
      target.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    }
    // Session cookies refreshed during this pass are carried onto the
    // redirect; dropping them would sign the user out on every redirect.
    return applySecurityHeaders(
      copySessionCookies(getResponse(), NextResponse.redirect(target)),
      nonce,
    );
  }

  return applySecurityHeaders(getResponse(), nonce);
}
