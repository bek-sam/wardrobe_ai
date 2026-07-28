"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv, isSupabaseConfigured } from "@/lib/env/client";

import { supabaseCookieOptions } from "./cookie-options";

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase browser configuration is missing.");
  }

  // Same attributes the server and proxy clients write, so a cookie refreshed
  // in the browser cannot end up with a weaker SameSite/Secure combination
  // than the one the server issued.
  return createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabasePublishableKey, {
    cookieOptions: supabaseCookieOptions(),
  });
}
