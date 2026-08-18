export type CandidateView = {
  crop_storage_path?: string | null;
  cutout_storage_path?: string | null;
  failed_cutout_storage_path?: string | null;
  modeled_storage_path?: string | null;
  [key: string]: unknown;
};

export type JobView = {
  user_id: string;
  original_image_bucket: string;
  original_image_path: string;
  import_job_candidates?: CandidateView[] | null;
  [key: string]: unknown;
};
