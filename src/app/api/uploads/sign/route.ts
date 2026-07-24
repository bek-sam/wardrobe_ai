import { NextResponse } from "next/server";

import { signUploadSchema } from "@/features/uploads/schemas";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleSignUpload } from "./handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, signUploadSchema),
      createClient(),
    ]);

    const data = await handleSignUpload(supabase, viewer.id, input);
    return NextResponse.json(
      { data },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
