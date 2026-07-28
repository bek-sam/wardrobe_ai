import type { StylistCapabilities } from "@/features/stylist/capabilities";
import { StylistWorkspace } from "@/features/stylist/components/StylistWorkspace";
import { isSupabaseConfigured } from "@/lib/env/client";
import { getServerEnvironment } from "@/lib/env/server";

export const metadata = { title: "AI Stylist" };
export const dynamic = "force-dynamic";

export default function StylistPage() {
  const environment = getServerEnvironment();
  const recommendationDate = new Date();
  recommendationDate.setUTCDate(recommendationDate.getUTCDate() + 1);
  const supabaseConfigured = isSupabaseConfigured();

  // Chat needs an account, not a model: item lookups and insights are answered
  // from the user's own rows. Only the generation flags depend on OpenAI.
  const capabilities: StylistCapabilities = {
    chatAvailable: Boolean(supabaseConfigured && environment.SUPABASE_SERVICE_ROLE_KEY),
    outfitGenerationAvailable: Boolean(
      environment.OPENAI_API_KEY && environment.OPENAI_STYLIST_MODEL,
    ),
    planGenerationAvailable: Boolean(
      environment.OPENAI_API_KEY && environment.OPENAI_PLANNER_MODEL,
    ),
  };

  return (
    <div className="page-stack stylist-page">
      <StylistWorkspace
        capabilities={capabilities}
        initialDate={recommendationDate.toISOString().slice(0, 10)}
        supabaseConfigured={supabaseConfigured}
      />
    </div>
  );
}
