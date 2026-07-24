import { matchOutfitToCandidateAndEnqueue } from "./match-outfit-to-candidate";
import type { AdminClient, ServerEnvironment } from "./types";

export async function sweepTomorrowPlans(admin: AdminClient, environment: ServerEnvironment) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const { data: planRows } = await admin
    .from("outfit_plans")
    .select("user_id, outfit_id")
    .eq("planned_date", tomorrow)
    .eq("status", "planned")
    .not("outfit_id", "is", null)
    .limit(200);
  for (const plan of planRows ?? []) {
    await matchOutfitToCandidateAndEnqueue(
      admin,
      plan.user_id as string,
      plan.outfit_id as string,
      "tomorrow_plan",
      environment,
    ).catch(() => {});
  }
}
