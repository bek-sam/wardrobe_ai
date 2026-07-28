import { NextResponse } from "next/server";

/**
 * Redirect for a form-POST auth route.
 *
 * The `Location` header is deliberately a *relative* path. Building an
 * absolute URL from `request.url` would mean trusting the `Host` header, which
 * a request can set freely — enough to bounce a user who just authenticated
 * off to another origin. A relative target is resolved by the browser against
 * the origin it actually connected to, so there is nothing to poison.
 *
 * `no-store` on every auth response keeps a shared cache from ever holding a
 * page that was rendered for one signed-in user.
 */
export function authRedirect(
  path: string,
  options?: { error?: string; notice?: string },
): NextResponse {
  const target = new URL(path, "http://relative.invalid");
  if (options?.error) target.searchParams.set("error", options.error);
  if (options?.notice) target.searchParams.set("notice", options.notice);

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: `${target.pathname}${target.search}`,
      "Cache-Control": "no-store",
    },
  });
}

/** Redirect to an external, provider-supplied URL (only ever a Supabase OAuth URL). */
export function providerRedirect(url: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: url, "Cache-Control": "no-store" },
  });
}
