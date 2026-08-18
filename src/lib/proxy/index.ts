import { safeReturnTo } from "@/lib/auth/redirects";
import { DEFAULT_SIGNED_IN_PATH } from "@/lib/auth/constants";
import { type NextRequest, NextResponse } from "next/server";

export const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/magic-link",
  "/check-email",
  "/reset-password",
  "/account-deleted",
  "/privacy",
  "/terms",
  "/auth/callback",
  "/auth/callback/recovery",
  "/auth/callback/magic-link",
  "/auth/callback/reauthenticate",
]);

export const SIGNED_OUT_ONLY_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/magic-link",
]);

export const MFA_PENDING_ROUTES = new Set([
  "/mfa/verify",
  "/reset-password",
  "/account-deleted",
  "/privacy",
  "/terms",
]);

export function carriedDestination(url: URL): string {
  return SIGNED_OUT_ONLY_ROUTES.has(url.pathname)
    ? safeReturnTo(url.searchParams.get("returnTo"))
    : `${url.pathname}${url.search}`;
}

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function publicStorageOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_STORAGE_ORIGIN;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function captchaEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_CAPTCHA_ENABLED;
  return typeof value === "string" && ["true", "1", "yes", "on"].includes(value.trim());
}

export function buildContentSecurityPolicy(nonce: string): string {
  const development = process.env.NODE_ENV === "development";
  const storage = publicStorageOrigin();
  const remote = storage ? ` ${storage}` : "";
  const turnstile = captchaEnabled() ? ` ${TURNSTILE_ORIGIN}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${turnstile}${development ? " 'unsafe-eval' 'unsafe-inline'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${remote}`,
    `connect-src 'self'${remote}${turnstile}${development ? " ws:" : ""}`,
    "font-src 'self'",
    `frame-src ${captchaEnabled() ? TURNSTILE_ORIGIN : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function requestHeaders(request: NextRequest, nonce: string): Headers {
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  return headers;
}

export type RouteDecision =
  | { kind: "continue" }
  | { kind: "redirect"; pathname: string; carryReturnTo: boolean; honorReturnTo?: boolean };
export type RouteState = { signedIn: boolean; needsMfa: boolean };

export function resolveRoute(pathname: string, state: RouteState): RouteDecision {
  const isApi = pathname.startsWith("/api/");
  if (!state.signedIn) {
    if (isApi || PUBLIC_ROUTES.has(pathname)) return { kind: "continue" };
    return { kind: "redirect", pathname: "/login", carryReturnTo: true };
  }
  if (state.needsMfa && !isApi && !MFA_PENDING_ROUTES.has(pathname)) {
    return { kind: "redirect", pathname: "/mfa/verify", carryReturnTo: true };
  }
  if (SIGNED_OUT_ONLY_ROUTES.has(pathname)) {
    // A signed-in visitor still carries a destination in `returnTo`, and
    // arriving here with one is normal rather than exceptional: any reload that
    // cancels the post-login redirect lands the browser back on /login with the
    // session already established. Defaulting would silently discard where the
    // user was going, so the carried destination wins when there is one.
    return {
      kind: "redirect",
      pathname: DEFAULT_SIGNED_IN_PATH,
      carryReturnTo: false,
      honorReturnTo: true,
    };
  }
  return { kind: "continue" };
}

export function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

type SessionPayload = { data?: { authenticated?: boolean; needsMfa?: boolean } };

async function readSessionOverHttp(request: NextRequest) {
  const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";
  const response = await fetch(new URL("/api/v1/session", backend), {
    headers: { cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => null)) as SessionPayload | null;
  const state: RouteState = {
    signedIn: response.ok && payload?.data?.authenticated === true,
    needsMfa: response.ok && payload?.data?.needsMfa === true,
  };
  const headerApi = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    headerApi.getSetCookie?.() ??
    (response.headers.get("set-cookie") ? [response.headers.get("set-cookie") as string] : []);
  return { state, setCookies };
}

function carrySetCookies(response: NextResponse, values: readonly string[]) {
  for (const value of values) response.headers.append("set-cookie", value);
  return response;
}

export async function runProxy(request: NextRequest) {
  const nonce = createNonce();
  const pathname = request.nextUrl.pathname;
  const forwarded = requestHeaders(request, nonce);

  // API/Auth transports authenticate in Backend. Skipping a second session
  // round trip also keeps uploads and streaming requests cheap.
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/callback")) {
    return applySecurityHeaders(NextResponse.next({ request: { headers: forwarded } }), nonce);
  }

  let session: Awaited<ReturnType<typeof readSessionOverHttp>>;
  try {
    session = await readSessionOverHttp(request);
  } catch {
    session = { state: { signedIn: false, needsMfa: false }, setCookies: [] };
  }
  const decision = resolveRoute(pathname, session.state);
  if (decision.kind === "redirect") {
    const target = request.nextUrl.clone();
    if (decision.honorReturnTo) {
      // `carriedDestination` has already run the value through `safeReturnTo`,
      // so this is a same-origin path — never a destination the query controls.
      const destination = new URL(carriedDestination(request.nextUrl), request.nextUrl.origin);
      target.pathname = destination.pathname;
      target.search = destination.search;
    } else {
      target.pathname = decision.pathname;
      target.search = "";
      if (decision.carryReturnTo)
        target.searchParams.set("returnTo", carriedDestination(request.nextUrl));
    }
    return applySecurityHeaders(
      carrySetCookies(NextResponse.redirect(target), session.setCookies),
      nonce,
    );
  }
  return applySecurityHeaders(
    carrySetCookies(NextResponse.next({ request: { headers: forwarded } }), session.setCookies),
    nonce,
  );
}
