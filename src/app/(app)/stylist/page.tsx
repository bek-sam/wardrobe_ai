import type { StylistCapabilities } from "@/features/stylist";
import { StylistWorkspace } from "@/features/stylist/components";
import { getFrontendConfig } from "@/lib/backend/server";

export const metadata = { title: "AI Stylist" };
export const dynamic = "force-dynamic";

export default async function StylistPage() {
  const config = await getFrontendConfig();
  const recommendationDate = new Date();
  recommendationDate.setUTCDate(recommendationDate.getUTCDate() + 1);
  const supabaseConfigured = config.databaseConfigured;

  // Chat needs an account, not a model: item lookups and insights are answered
  // from the user's own rows. Only the generation flags depend on OpenAI.
  const capabilities: StylistCapabilities = {
    chatAvailable: config.capabilities.chatAvailable,
    outfitGenerationAvailable: config.capabilities.outfitGenerationAvailable,
    planGenerationAvailable: config.capabilities.planGenerationAvailable,
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
