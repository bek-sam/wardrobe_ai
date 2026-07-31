import { resolveVisualizationProvider } from "@/lib/ai/visualization-provider";

import { stageWriters } from "./advance-stage";
import { generateWithQaGate } from "./generate-with-qa";
import { handleVisualizationFailure } from "./handle-failure";
import { loadGarmentInputs } from "./load-inputs";
import { loadJobContext } from "./load-job-context";
import { locateGarmentHotspots } from "./locate-hotspots";
import { storeVisualizationResult } from "./store-result";
import type { AdminClient, VisualizationJobRow, VisualizationJobOutcome } from "./types";

/**
 * Renders one already-claimed (status='running') job through the full
 * pipeline: validating_inputs -> generating -> qa_review -> localizing ->
 * ready. Each stage is written back so the UI's named progress steps describe
 * real work. The caller is responsible for claiming the job first.
 */
export async function processClaimedVisualizationJob(
  admin: AdminClient,
  job: VisualizationJobRow,
): Promise<VisualizationJobOutcome> {
  try {
    const { advance, supersede } = stageWriters(admin, job);

    await advance("validating_inputs");
    const context = await loadJobContext(admin, job);
    if (!context) {
      await supersede("inputs_unavailable");
      return "superseded";
    }

    const provider = resolveVisualizationProvider();
    const garments = await loadGarmentInputs(admin, job.user_id, context.items);
    const attempt = { userId: job.user_id, identity: context.identity, garments };

    const accepted = await generateWithQaGate(
      provider,
      attempt,
      context.visualization.corrective_attempt_count,
      advance,
    );

    await advance("localizing");
    const hotspots = await locateGarmentHotspots(provider, {
      ...attempt,
      image: accepted.image.bytes,
    });

    await storeVisualizationResult(admin, job, { ...accepted, hotspots });
    return "completed";
  } catch (error) {
    await handleVisualizationFailure(admin, job, error);
    return "failed";
  }
}
