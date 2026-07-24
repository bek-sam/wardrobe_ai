import { NextResponse } from "next/server";

import { generateOutfitRequestSchema } from "@/features/stylist/schemas";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleGenerateOutfit } from "./handler";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, generateOutfitRequestSchema),
      createClient(),
    ]);

    const data = await handleGenerateOutfit(supabase, viewer.id, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
