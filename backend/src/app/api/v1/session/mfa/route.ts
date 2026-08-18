import { NextResponse } from "next/server";

import { requireLiveUser } from "@/lib/auth/server";
import { routeError } from "@/lib/api/response";

export async function GET() {
  try {
    const { supabase } = await requireLiveUser();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return NextResponse.json(
      {
        data: {
          factors: (data?.totp ?? []).map((factor) => ({
            id: factor.id,
            label: factor.friendly_name ?? "Authenticator app",
          })),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
