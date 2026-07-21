import { createClient } from "@supabase/supabase-js";
import { requireEnvironment } from "@/lib/env/server";

export function createAdminClient() {
  const environment = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");

  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
