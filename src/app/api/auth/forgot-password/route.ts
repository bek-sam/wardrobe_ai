import { NextResponse } from "next/server";
import { forgotPasswordSchema, formDataObject } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { getServerEnvironment } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rejected = rejectUntrustedOrigin(request);
  if (rejected) return rejected;
  const parsed = forgotPasswordSchema.safeParse(formDataObject(await request.formData()));
  if (parsed.success) {
    const environment = getServerEnvironment();
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${environment.NEXT_PUBLIC_APP_URL}/auth/callback?returnTo=/settings`,
    });
  }

  const target = new URL("/login", request.url);
  target.searchParams.set(
    "notice",
    "If an account exists for that email, a password reset link is on its way.",
  );
  return NextResponse.redirect(target, { status: 303 });
}
