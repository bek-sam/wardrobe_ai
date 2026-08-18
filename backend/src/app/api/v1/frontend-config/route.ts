import { NextResponse } from "next/server";

import { getAuthFlags } from "@/lib/auth/server";
import { getServerEnvironment } from "@/lib/env/server";

export function GET() {
  const environment = getServerEnvironment();
  const auth = getAuthFlags();
  return NextResponse.json(
    {
      data: {
        databaseConfigured: Boolean(
          environment.SUPABASE_URL && environment.SUPABASE_PUBLISHABLE_KEY,
        ),
        publicSignupEnabled: auth.publicSignupEnabled,
        googleAuthEnabled: auth.googleAuthEnabled,
        magicLinkEnabled: auth.magicLinkEnabled,
        captchaEnabled: auth.captchaEnabled,
        turnstileSiteKey: auth.turnstileSiteKey,
        capabilities: {
          chatAvailable: Boolean(environment.SUPABASE_SERVICE_ROLE_KEY),
          outfitGenerationAvailable: Boolean(
            process.env.AI_ORCHESTRATION_URL && process.env.AI_SERVICE_TOKEN,
          ),
          planGenerationAvailable: Boolean(
            process.env.AI_ORCHESTRATION_URL && process.env.AI_SERVICE_TOKEN,
          ),
          visualizationAvailable: Boolean(
            process.env.AI_ORCHESTRATION_URL && process.env.AI_SERVICE_TOKEN,
          ),
        },
      },
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
  );
}
