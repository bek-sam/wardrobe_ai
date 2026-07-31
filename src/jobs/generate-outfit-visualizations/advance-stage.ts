import type { AdminClient, VisualizationJobRow } from "./types";

/**
 * Stage transitions and the supersede path, both through RPCs rather than raw
 * table writes, so the visualization row and its job can never disagree about
 * where the work got to.
 */
export function stageWriters(admin: AdminClient, job: VisualizationJobRow) {
  const advance = async (status: string) => {
    await admin.rpc("advance_outfit_visualization", {
      p_visualization_id: job.visualization_id,
      p_user_id: job.user_id,
      p_status: status,
    });
  };

  /**
   * Retires the visualization row too, not just the job. Marking only the job
   * left the visualization at 'validating_inputs', which the client treats as
   * in-flight and polls forever with no terminal state and no retry.
   */
  const supersede = async (reason: string) => {
    await admin.rpc("supersede_outfit_visualization", {
      p_job_id: job.id,
      p_user_id: job.user_id,
      p_reason: reason,
    });
  };

  return { advance, supersede };
}
