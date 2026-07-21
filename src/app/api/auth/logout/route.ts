import { NextResponse } from "next/server";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rejected = rejectUntrustedOrigin(request);
  if (rejected) return rejected;
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
