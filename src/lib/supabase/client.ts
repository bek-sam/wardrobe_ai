"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv, isSupabaseConfigured } from "@/lib/env/client";

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase browser configuration is missing.");
  }

  return createBrowserClient(clientEnv.supabaseUrl, clientEnv.supabasePublishableKey);
}
