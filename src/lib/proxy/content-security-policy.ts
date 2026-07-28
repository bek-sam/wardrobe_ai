const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

/**
 * Builds the policy for one request.
 *
 * Production carries **no** `script-src 'unsafe-inline'`. Next.js needs to run
 * inline bootstrap scripts, so each one is authorized by a per-request nonce
 * instead — which is the difference between "any injected script runs" and
 * "only scripts this response vouched for run". That matters more here than in
 * most apps: the Supabase session cookie is readable by script by design, so
 * script injection would mean session theft.
 *
 * `'strict-dynamic'` is omitted deliberately; the explicit `'self'` source
 * keeps Next's chunk loading working under an exact-origin policy.
 *
 * `style-src` keeps `'unsafe-inline'`: React writes inline `style` attributes,
 * and nonces do not apply to attributes. Inline CSS cannot execute script, so
 * this is a far weaker concession than the script one it replaces.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";
  const supabase = supabaseOrigin();
  const remote = supabase ? ` ${supabase}` : "";
  const turnstile = captchaEnabled() ? ` ${TURNSTILE_ORIGIN}` : "";

  return [
    "default-src 'self'",
    // 'unsafe-eval' only under `next dev`, which evaluates source maps.
    `script-src 'self' 'nonce-${nonce}'${turnstile}${isDevelopment ? " 'unsafe-eval' 'unsafe-inline'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${remote}`,
    `connect-src 'self'${remote}${turnstile}${isDevelopment ? " ws:" : ""}`,
    "font-src 'self'",
    // Turnstile renders its challenge in an iframe; nothing else may be framed.
    `frame-src ${captchaEnabled() ? TURNSTILE_ORIGIN : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
