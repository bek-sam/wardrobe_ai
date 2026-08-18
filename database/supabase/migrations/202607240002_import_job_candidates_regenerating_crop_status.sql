-- Adds 'regenerating_crop' to import_job_candidates.status so approve-crop
-- can claim a candidate for crop regeneration without making it visible to
-- the background worker's extracting-only query -- the candidate only
-- becomes 'extracting' once the regenerated crop has actually been
-- uploaded, so the worker can never extract from a stale crop.
alter table public.import_job_candidates
  drop constraint import_job_candidates_status_check;

alter table public.import_job_candidates
  add constraint import_job_candidates_status_check check (
    status in (
      'detected',
      'review_crop',
      'regenerating_crop',
      'extracting',
      'review_cutout',
      'review_metadata',
      'researching',
      'approved',
      'rejected',
      'failed'
    )
  );
