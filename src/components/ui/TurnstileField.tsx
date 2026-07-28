"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

import { clientEnv, isCaptchaConfigured } from "@/lib/env/client";

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing when CAPTCHA is off, so a deployment without it has no dead
 * markup and no request to Cloudflare. The token it produces is submitted with
 * the form and passed on to Supabase, which holds the secret and performs the
 * actual verification — this component is a token source, never a gate. The
 * server refuses the request outright when the flag is on and no token
 * arrives, so removing this widget in the browser fails the submission rather
 * than bypassing it.
 */
export function TurnstileField({ action }: { action: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A used token is single-use, so a failed submit must leave a fresh one
    // behind or the retry is rejected for a reason the user cannot see.
    const node = container.current;
    return () => {
      if (node) node.innerHTML = "";
    };
  }, []);

  if (!isCaptchaConfigured()) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        id="cf-turnstile"
      />
      <div
        className="cf-turnstile"
        data-action={action}
        data-response-field-name="captchaToken"
        data-sitekey={clientEnv.turnstileSiteKey}
        ref={container}
      />
    </>
  );
}
