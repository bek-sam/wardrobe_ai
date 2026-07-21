import { InsightsManager } from "@/features/insights/components/InsightsManager";
import { isSupabaseConfigured } from "@/lib/env/client";

import { previewItems } from "../preview-data";

export const metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <div className="page-stack insights-page">
      <InsightsManager configured={isSupabaseConfigured()} previewItems={previewItems} />
    </div>
  );
}
