export type CompileStatusResponse = {
  dirty_since: string | null;
  last_compiled_at: string | null;
  candidate_count: number;
  compiled_wardrobe_version: string | null;
  latest_job_status: "queued" | "running" | "complete" | "failed" | null;
};

export type RecompileResponse = { status: "up_to_date" | "running" | "queued" | "complete" };
