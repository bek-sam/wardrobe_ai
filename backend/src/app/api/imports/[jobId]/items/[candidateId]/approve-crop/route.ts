import { NextResponse } from "next/server";

import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

import { handleApproveCrop } from "./handler";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ jobId, candidateId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);

    const data = await handleApproveCrop(supabase, viewer.id, jobId, candidateId);
    return NextResponse.json({ data }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
