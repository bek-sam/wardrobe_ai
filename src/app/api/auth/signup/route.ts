import { NextResponse } from "next/server";
import { formDataObject, signupSchema } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { getServerEnvironment } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rejected = rejectUntrustedOrigin(request);
  if (rejected) return rejected;
  const parsed = signupSchema.safeParse(formDataObject(await request.formData()));
  if (!parsed.success) {
    const target = new URL("/signup", request.url);
    target.searchParams.set(
      "error",
      "Check the form and use a password with at least 8 characters.",
    );
    return NextResponse.redirect(target, { status: 303 });
  }

  const environment = getServerEnvironment();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${environment.NEXT_PUBLIC_APP_URL}/auth/callback?returnTo=/onboarding`,
      data: { first_name: parsed.data.firstName },
    },
  });
  if (error) {
    const target = new URL("/signup", request.url);
    target.searchParams.set("error", "The account could not be created. Try signing in instead.");
    return NextResponse.redirect(target, { status: 303 });
  }

  if (data.session)
    return NextResponse.redirect(new URL("/onboarding", request.url), { status: 303 });
  const target = new URL("/login", request.url);
  target.searchParams.set("notice", "Check your email to confirm your account.");
  return NextResponse.redirect(target, { status: 303 });
}
