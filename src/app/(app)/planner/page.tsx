import { PlannerWorkspace } from "@/features/planner/components/PlannerWorkspace";
import { isSupabaseConfigured } from "@/lib/env/client";
import { getServerEnvironment } from "@/lib/env/server";

export const metadata = { title: "Planner" };
export const dynamic = "force-dynamic";

export default function PlannerPage() {
  const environment = getServerEnvironment();
  return (
    <div className="page-stack planner-page">
      <PlannerWorkspace
        aiConfigured={Boolean(environment.OPENAI_API_KEY && environment.OPENAI_PLANNER_MODEL)}
        initialDate={new Date().toISOString().slice(0, 10)}
        supabaseConfigured={isSupabaseConfigured()}
      />
    </div>
  );
}
