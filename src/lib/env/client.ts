const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// Next.js inlines NEXT_PUBLIC_* at build time only where the property is read
// literally, so each flag is dereferenced here rather than through a loop.
const flag = (value: string | undefined) =>
  typeof value === "string" && ["true", "1", "yes", "on"].includes(value.trim());

export const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl,
  supabasePublishableKey,
  googleAuthEnabled: flag(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED),
  magicLinkEnabled: flag(process.env.NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED),
  captchaEnabled: flag(process.env.NEXT_PUBLIC_CAPTCHA_ENABLED),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

/**
 * CAPTCHA is only enforceable when there is a site key to render a widget
 * with, so an enabled flag without a key reports as unconfigured here and is
 * rejected outright by the server flag resolver.
 */
export function isCaptchaConfigured(): boolean {
  return clientEnv.captchaEnabled && clientEnv.turnstileSiteKey.length > 0;
}
