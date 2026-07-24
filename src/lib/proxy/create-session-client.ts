import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export function createSessionClient(
  request: NextRequest,
  supabaseUrl: string,
  publishableKey: string,
) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  return { supabase, getResponse: () => response };
}
