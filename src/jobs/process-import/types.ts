export type ImportJobRow = {
  id: string;
  user_id: string;
  status: string;
  original_image_bucket: string;
  original_image_path: string;
  input_metadata: { userHint?: string | null } | null;
  attempt_count: number;
};

export type ImportCandidateRow = {
  id: string;
  user_id: string;
  job_id: string;
  status: string;
  crop_storage_path: string | null;
  proposed_metadata: Record<string, unknown>;
  confirmed_metadata: Record<string, unknown>;
  regeneration_prompt: string | null;
  cleanup_tolerance: number;
  extraction_attempt_count: number;
};
