import { NextResponse } from "next/server";

import { getAssuranceState, getViewer, hasCurrentLegalAcceptance } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { data: { authenticated: false, needsMfa: false, legalAccepted: false } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const supabase = await createClient();
  const [assurance, legalAccepted] = await Promise.all([
    getAssuranceState(supabase).catch(() => null),
    hasCurrentLegalAcceptance(supabase),
  ]);
  return NextResponse.json(
    {
      data: {
        authenticated: true,
        needsMfa: assurance?.needsChallenge ?? false,
        legalAccepted,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
