import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnvironment } from "@/lib/env/server";

export async function createClient() {
  const environment = requireEnvironment(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  const cookieStore = await cookies();

  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // A Server Component cannot write cookies. The proxy refreshes sessions.
          }
        },
      },
    },
  );
}
