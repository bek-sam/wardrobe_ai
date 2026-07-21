import { NextResponse } from "next/server";
import { formDataObject, loginSchema, safeReturnTo } from "@/features/auth/schemas";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rejected = rejectUntrustedOrigin(request);
  if (rejected) return rejected;
  const parsed = loginSchema.safeParse(formDataObject(await request.formData()));
  if (!parsed.success) {
    const target = new URL("/login", request.url);
    target.searchParams.set("error", "Enter a valid email address and password.");
    return NextResponse.redirect(target, { status: 303 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    const target = new URL("/login", request.url);
    target.searchParams.set("error", "The email or password is incorrect.");
    return NextResponse.redirect(target, { status: 303 });
  }

  return NextResponse.redirect(new URL(safeReturnTo(parsed.data.returnTo), request.url), {
    status: 303,
  });
}
