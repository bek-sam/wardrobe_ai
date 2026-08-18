import { PlannerWorkspace } from "@/features/planner/components";
import { getFrontendConfig } from "@/lib/backend/server";

export const metadata = { title: "Planner" };
export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const config = await getFrontendConfig();
  return (
    <div className="page-stack planner-page">
      <PlannerWorkspace
        aiConfigured={config.capabilities.planGenerationAvailable}
        initialDate={new Date().toISOString().slice(0, 10)}
        supabaseConfigured={config.databaseConfigured}
      />
    </div>
  );
}
