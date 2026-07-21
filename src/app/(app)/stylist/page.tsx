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
  return (
    <div className="page-stack stylist-page">
      <StylistWorkspace
        aiConfigured={Boolean(
          supabaseConfigured &&
          environment.SUPABASE_SERVICE_ROLE_KEY &&
          environment.OPENAI_API_KEY &&
          environment.OPENAI_STYLIST_MODEL,
        )}
        initialDate={recommendationDate.toISOString().slice(0, 10)}
        supabaseConfigured={supabaseConfigured}
      />
    </div>
  );
}
