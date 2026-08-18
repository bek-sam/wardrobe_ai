import { InsightsManager } from "@/features/insights/components";
import { getFrontendConfig } from "@/lib/backend/server";

import { previewItems } from "../preview-data";

export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  const configured = (await getFrontendConfig()).databaseConfigured;
  return (
    <div className="page-stack insights-page">
      <InsightsManager configured={configured} previewItems={previewItems} />
    </div>
  );
}
