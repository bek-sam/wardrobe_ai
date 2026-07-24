import { type NextRequest, NextResponse } from "next/server";

import { copySessionCookies } from "./copy-session-cookies";
import { createSessionClient } from "./create-session-client";
import { PUBLIC_ROUTES } from "./public-routes.data";

export async function runProxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    const response = NextResponse.next();
    response.headers.set("x-wardrobe-configuration", "demo");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const { supabase, getResponse } = createSessionClient(request, supabaseUrl, publishableKey);
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === "string";
  const pathname = request.nextUrl.pathname;

  if (!PUBLIC_ROUTES.has(pathname) && !pathname.startsWith("/api/") && !signedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return copySessionCookies(getResponse(), NextResponse.redirect(loginUrl));
  }

  if (signedIn && ["/login", "/signup", "/forgot-password"].includes(pathname)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/today";
    appUrl.search = "";
    return copySessionCookies(getResponse(), NextResponse.redirect(appUrl));
  }

  const response = getResponse();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
