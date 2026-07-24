import { NextResponse } from "next/server";

import { itemParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleUploadItemImage } from "./handler";

export const runtime = "nodejs";

type Context = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const formData = await request.formData();
    const supabase = await createClient();

    const data = await handleUploadItemImage(supabase, viewer.id, itemId, formData);
    return NextResponse.json(
      { data },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
